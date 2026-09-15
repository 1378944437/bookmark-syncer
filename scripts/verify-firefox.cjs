// Run through verify-extension.cjs --firefox with PLAYWRIGHT_BROWSERS_PATH pointing to installed runtimes.
const { firefox } = require(process.env.MARKSYNC_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const canonical = nodes => nodes.map(node => ({ title: node.title, ...(node.url ? { url: node.url } : { children: canonical(node.children || []) }) }));
module.exports = async function verifyFirefox({ device, send, state, add, bookmarks,
  expectSuccess, config, pass, contexts }) {
  const extension = path.resolve('apps/firefox-extension/dist');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  const addonId = manifest.browser_specific_settings.gecko.id;
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'marksync-firefox-'));
  const context = await firefox.launchPersistentContext(profile, { headless: true,
    args: ['-start-debugger-server', String(port)], firefoxUserPrefs: {
      'devtools.debugger.remote-enabled': true, 'devtools.debugger.prompt-connection': false,
      'devtools.debugger.force-local': true, 'devtools.chrome.enabled': true
    } });
  contexts.push(context);
  const { connectWithMaxRetries } = await import(pathToFileURL(path.resolve('node_modules/web-ext/lib/firefox/remote.js')).href);
  const remote = await connectWithMaxRetries({ port, maxRetries: 50, retryInterval: 100 });
  let page;
  try {
    await remote.installTemporaryAddon(extension, false);
    const addon = await remote.getInstalledAddon(addonId);
    console.log('Firefox background status: ' + addon.backgroundScriptStatus);
    const extensionUrl = new URL('index.html?mode=tab', addon.manifestURL).href;
    page = await require('./firefox-page.cjs')(remote, extensionUrl);
  } catch (error) { remote.disconnect(); throw error; }
  context.on('close', () => remote.disconnect());
  await page.evaluate(config => browser.storage.local.set({ app_language: 'en', auto_sync_enabled: false,
    scheduled_sync_enabled: false, storage_type: 'webdav', webdav_url: config.url,
    webdav_username: config.username, webdav_password: config.password,
    sync_scope: { 'bookmarks-bar': true, other: false, mobile: false } }), config);
  assert.equal((await send(page, { type: 'storage:test', config })).ok, true);
  pass('firefox-temporary-addon-load-and-real-background-connection', { firefoxVersion: context.browser().version() });

  const roots = (await page.evaluate(() => browser.bookmarks.getTree()))[0].children;
  const bar = roots.find(node => node.id === 'toolbar_____').id;
  const menu = roots.find(node => node.id === 'menu________').id;
  const other = roots.find(node => node.id === 'unfiled_____').id;
  // Only remove Firefox's bundled seed bookmarks in this new isolated profile.
  await page.evaluate(async roots => {
    for (const root of roots) for (const node of await browser.bookmarks.getChildren(root)) await browser.bookmarks.removeTree(node.id);
  }, [bar, menu, other]);
  await add(page, 'firefox-local', bar);
  const menuNode = await add(page, 'shared', menu);
  const otherNode = await add(page, 'shared', other);
  const edge = await device('firefox-peer');
  await add(edge.page, 'shared'); const deleted = await add(edge.page, 'to-delete');
  expectSuccess(await send(edge.page, { type: 'sync:push', config }));
  assert.equal((await send(page, { type: 'sync:smart', config })).needsConflictResolution, true);
  expectSuccess(await send(page, { type: 'sync:pull', config, mode: 'overwrite' }));
  assert.deepEqual((await bookmarks(page, bar)).map(node => node.title), ['shared', 'to-delete']);
  assert.equal((await bookmarks(page, menu))[0].id, menuNode.id);
  assert.equal((await bookmarks(page, other))[0].id, otherNode.id);
  pass('edge-to-firefox-pull-protects-menu-and-excluded-duplicate-urls');

  expectSuccess(await send(page, { type: 'sync:smart', config }));
  await edge.page.evaluate(id => chrome.bookmarks.remove(id), deleted.id);
  expectSuccess(await send(edge.page, { type: 'sync:push', config }));
  expectSuccess(await send(page, { type: 'sync:smart', config }));
  assert.deepEqual((await bookmarks(page, bar)).map(node => node.title), ['shared']);
  assert.equal((await bookmarks(page, menu))[0].id, menuNode.id);
  pass('cross-browser-remote-deletion-propagates-with-menu-preserved');

  const shared = (await bookmarks(page, bar))[0];
  await page.evaluate(id => browser.bookmarks.update(id, { title: 'firefox-unsent' }), shared.id);
  await add(edge.page, 'edge-new'); expectSuccess(await send(edge.page, { type: 'sync:push', config }));
  assert.equal((await send(page, { type: 'sync:smart', config })).needsConflictResolution, true);
  assert.equal((await bookmarks(page, bar))[0].title, 'firefox-unsent');
  pass('firefox-dirty-local-change-requires-direction-choice');

  expectSuccess(await send(page, { type: 'sync:push', config }));
  expectSuccess(await send(edge.page, { type: 'sync:smart', config }));
  assert.deepEqual((await bookmarks(edge.page)).map(node => node.title), ['firefox-unsent']);
  pass('firefox-to-edge-explicit-push-and-automatic-pull');

  const before = canonical(await page.evaluate(() => browser.bookmarks.getTree()));
  const cleared = await send(page, { type: 'storage:maintenance', kind: 'local' });
  assert(Number.isSafeInteger(cleared.snapshotId));
  for (const root of [bar, menu, other]) assert.equal((await bookmarks(page, root)).length, 0);
  expectSuccess(await send(page, { type: 'sync:restoreLocalSnapshot', id: cleared.snapshotId }));
  assert.deepEqual(canonical(await page.evaluate(() => browser.bookmarks.getTree())), before);
  assert.equal((await state(page)).bookmark_recovery, undefined);
  assert.equal((await state(page)).syncState, undefined);
  pass('firefox-indexeddb-snapshot-restores-toolbar-menu-and-other');
};
