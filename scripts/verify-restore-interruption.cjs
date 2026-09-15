// Run through: node scripts/verify-extension.cjs --restore-interruption
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const canonical = nodes => nodes.map(node => ({ title: node.title, ...(node.url ? { url: node.url } :
  { children: canonical(node.children || []) }) }));
const tree = page => page.evaluate(() => chrome.bookmarks.getTree());
const snapshots = page => page.evaluate(() => new Promise((resolve, reject) => {
  const opening = indexedDB.open('bookmark-syncer-db');
  opening.onerror = () => reject(opening.error);
  opening.onsuccess = () => {
    const db = opening.result, tx = db.transaction('snapshots', 'readonly');
    const request = tx.objectStore('snapshots').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  };
}));
module.exports = async function verifyRestore({ device, send, state, expectSuccess, config,
  requests, until, pause, pass, output }) {
  let a = await device('restore-interruption');
  await a.page.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'restore-folder' });
    for (let i = 0; i < 6; i++) await chrome.bookmarks.create({ parentId: folder.id,
      title: 'restore-' + i, url: 'https://marksync.invalid/restore-' + i });
    await chrome.bookmarks.create({ parentId: '2', title: 'restore-other', url: 'https://marksync.invalid/restore-other' });
  });
  const targetTree = canonical(await tree(a.page));
  const cleared = await send(a.page, { type: 'storage:maintenance', kind: 'local' });
  assert(Number.isSafeInteger(cleared.snapshotId));
  await a.page.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'before-folder' });
    await chrome.bookmarks.create({ parentId: folder.id, title: 'before-child', url: 'https://marksync.invalid/before-child' });
    await chrome.bookmarks.create({ parentId: '1', title: 'before-bar', url: 'https://marksync.invalid/before-bar' });
    await chrome.bookmarks.create({ parentId: '2', title: 'before-other', url: 'https://marksync.invalid/before-other' });
  });
  expectSuccess(await send(a.page, { type: 'sync:push', config }));
  const original = canonical(await tree(a.page));
  await a.context.close(); a = await device('restore-persisted', a.profile);
  assert.deepEqual(canonical(await tree(a.page)), original);
  const worker = a.context.serviceWorkers()[0];
  await worker.evaluate(() => {
    const create = chrome.bookmarks.create.bind(chrome.bookmarks);
    globalThis.restoreProbe = { created: 0, paused: false };
    chrome.bookmarks.create = (details, callback) => create(details).then(node => {
      if (++globalThis.restoreProbe.created === 3) {
        globalThis.restoreProbe.paused = true;
        return new Promise(() => {});
      }
      if (callback) callback(node);
      return node;
    });
  });
  const sending = send(a.page, { type: 'sync:restoreLocalSnapshot', id: cleared.snapshotId }).catch(() => null);
  await until(() => worker.evaluate(() => globalThis.restoreProbe.paused));
  const partial = canonical(await tree(a.page)), interrupted = await state(a.page);
  assert.notDeepEqual(partial, original); assert.notDeepEqual(partial, targetTree);
  const recovery = interrupted.bookmark_recovery;
  assert.equal(recovery.kind, 'local-restore');
  const safety = (await snapshots(a.page)).find(snapshot => snapshot.id === recovery.snapshotId);
  assert.deepEqual(canonical(safety.tree), original);
  // Allow Chromium's native bookmark file to flush while the restore callback remains suspended.
  await pause(6000);
  const cdp = await a.context.browser().newBrowserCDPSession();
  await Promise.race([cdp.send('Browser.crash').catch(() => {}), pause(3000)]);
  await Promise.race([sending, pause(1000)]);
  await Promise.race([a.context.close().catch(() => {}), pause(3000)]);
  const b = await device('restore-reopen', a.profile);
  assert.deepEqual(canonical(await tree(b.page)), partial);
  assert.deepEqual((await state(b.page)).bookmark_recovery, recovery);
  assert.deepEqual(canonical((await snapshots(b.page)).find(s => s.id === recovery.snapshotId).tree), original);
  await b.page.getByRole('button', { name: 'Restore bookmarks from before the operation', exact: true }).waitFor();
  fs.mkdirSync(output, { recursive: true });
  await b.page.screenshot({ path: path.join(output, 'interrupted-restore.png'), fullPage: true });
  pass('partial-restore-and-safety-snapshot-survive-browser-crash');

  const puts = requests.filter(r => r.method === 'PUT').length;
  await b.page.evaluate(() => chrome.storage.local.set({ auto_sync_enabled: true }));
  const pending = (await state(b.page)).pending_bookmark_upload;
  await b.page.evaluate(() => chrome.bookmarks.create({ parentId: '1', title: 'edit-during-recovery', url: 'https://marksync.invalid/edit-during-recovery' }));
  const lock = (await state(b.page)).sync_lock;
  assert.equal(lock.holder, 'local-restore');
  const locked = await send(b.page, { type: 'sync:restoreLocalSnapshot', id: recovery.snapshotId });
  assert.equal(locked.success, false); assert.match(locked.message, /进行中/);
  while (Date.now() <= lock.timestamp + 300100) {
    const remaining = lock.timestamp + 300101 - Date.now();
    console.log('WAIT natural restore-lock expiry: ' + Math.ceil(remaining / 1000) + ' seconds');
    await pause(Math.min(remaining, 30000));
  }
  assert.deepEqual((await state(b.page)).pending_bookmark_upload, pending);
  const refused = await send(b.page, { type: 'sync:push', config });
  assert.equal(refused.success, false); assert.match(refused.message, /未完成/);
  assert.equal(requests.filter(r => r.method === 'PUT').length, puts);
  pass('recovery-record-blocks-edits-auto-upload-and-manual-upload-after-lock-expiry');

  const countBefore = (await snapshots(b.page)).length;
  await b.page.evaluate(() => chrome.storage.local.set({ auto_sync_enabled: false }));
  await b.page.getByRole('button', { name: 'Restore bookmarks from before the operation', exact: true }).click();
  await b.page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await until(async () => !(await state(b.page)).bookmark_recovery);
  assert.deepEqual(canonical(await tree(b.page)), original);
  assert.equal((await state(b.page)).syncState, undefined);
  await until(async () => !(await state(b.page)).sync_lock);
  assert.equal((await snapshots(b.page)).length, countBefore);
  assert.equal(requests.filter(r => r.method === 'PUT').length, puts);
  await b.context.close();
  const c = await device('restore-verified', b.profile);
  assert.deepEqual(canonical(await tree(c.page)), original);
  assert.equal((await state(c.page)).bookmark_recovery, undefined);
  assert.equal((await state(c.page)).syncState, undefined);
  pass('recovery-ui-restores-full-original-tree-and-clears-baseline-durably');
};
