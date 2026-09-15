// Read-only connection acceptance through the actual extension background.
// Usage: MARKSYNC_PLAYWRIGHT=<module> node scripts/verify-service.cjs --config <local JSON>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const http = require('node:http');
const { validateSettings } = require('../packages/app/src/application/settings-validation.ts');

function validateConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_config');
  if (value.type === 'webdav') {
    if (!['url', 'username', 'password'].every(key => typeof value[key] === 'string') || !value.url.trim()) throw new Error('invalid_config');
    validateSettings({ storage_type: value.type, webdav_url: value.url, webdav_username: value.username, webdav_password: value.password });
    return { type: 'webdav', url: value.url.trim(), username: value.username, password: value.password };
  }
  if (value.type === 'gist') {
    if (typeof value.token !== 'string' || !value.token.trim() || typeof value.gistId !== 'string' || !/^[0-9a-f]+$/i.test(value.gistId)) throw new Error('invalid_config');
    const endpoint = value.endpoint === undefined ? 'https://api.github.com' : value.endpoint;
    if (typeof endpoint !== 'string' || !endpoint.trim()) throw new Error('invalid_config');
    validateSettings({ storage_type: value.type, gist_token: value.token, gist_id: value.gistId, gist_endpoint: endpoint });
    return { type: 'gist', token: value.token.trim(), gistId: value.gistId, endpoint: endpoint.trim() };
  }
  throw new Error('invalid_config');
}
function summarize(result) {
  if (result?.ok === true) return { status: 'passed', code: 'connection_accepted' };
  // Only a fixed category and optional status code leave the browser; never persist raw service errors.
  const message = typeof result?.error === 'string' ? result.error : '';
  const status = message.match(/\b(?:HTTP\s*|\()(4\d\d|5\d\d)\b/)?.[1];
  return { status: 'failed', code: 'connection_rejected', ...(status ? { httpStatus: Number(status) } : {}) };
}
async function openExtension() {
  const { chromium } = require(process.env.MARKSYNC_PLAYWRIGHT || 'playwright');
  const extension = path.resolve('apps/chrome-extension/dist');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
  const id = crypto.createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex')
    .slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'marksync-service-check-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/index.html?mode=tab`);
    await page.evaluate(() => chrome.storage.local.set({ auto_sync_enabled: false, scheduled_sync_enabled: false }));
    return { context, page, version: context.browser().version(), extensionVersion: manifest.version };
  } catch (error) { await context.close(); throw error; }
}
async function check(page, config) {
  return page.evaluate(async config => {
    const result = await chrome.runtime.sendMessage({ type: 'storage:test', config });
    // Reduce inside the extension page so a server-supplied message is never part of tool output.
    if (result?.ok === true) return { ok: true };
    const status = typeof result?.error === 'string' ? result.error.match(/\b(?:HTTP\s*|\()(4\d\d|5\d\d)\b/)?.[1] : undefined;
    return { ok: false, ...(status ? { error: 'HTTP ' + status } : {}) };
  }, config);
}
async function selfTest(page) {
  const methods = [], results = [];
  const basic = 'Basic ' + Buffer.from('test-user:test-password').toString('base64');
  const server = http.createServer((req, res) => {
    methods.push(req.method);
    const gist = req.url.includes('/gists/');
    const authenticated = req.headers.authorization === (gist ? 'Bearer test-token' : basic);
    const status = req.url.startsWith('/unavailable') ? 503 : authenticated ? (gist ? 200 : 207) : 401;
    res.writeHead(status, { 'Content-Type': gist ? 'application/json' : 'application/xml' });
    res.end(gist ? '{}' : '<d:multistatus xmlns:d="DAV:"/>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    for (const type of ['webdav', 'gist']) for (const outcome of ['accepted', 'unauthorized', 'unavailable']) {
      const url = endpoint + (outcome === 'unavailable' ? '/unavailable' : '/service');
      const config = validateConfig(type === 'webdav'
        ? { type, url, username: 'test-user', password: outcome === 'unauthorized' ? 'wrong' : 'test-password' }
        : { type, endpoint: url, gistId: 'abc123', token: outcome === 'unauthorized' ? 'wrong' : 'test-token' });
      const result = summarize(await check(page, config));
      assert.equal(result.status, outcome === 'accepted' ? 'passed' : 'failed');
      results.push({ name: type + '-' + outcome, status: 'passed' });
    }
    assert.equal(methods.length, 6);
    assert(methods.every(method => ['GET', 'PROPFIND'].includes(method)));
    const stored = await page.evaluate(() => chrome.storage.local.get(['webdav_url', 'webdav_username', 'webdav_password', 'gist_id', 'gist_token', 'gist_endpoint']));
    assert.deepEqual(stored, {});
    results.push({ name: 'no-external-write-or-provider-config-persistence', status: 'passed' });
    assert.throws(() => validateConfig({ type: 'webdav', url: 'https://user:secret@dav.example.com', username: '', password: '' }));
    assert.throws(() => validateConfig({ type: 'gist', token: 'test', gistId: '../../user' }));
    assert.deepEqual(summarize({ error: 'https://private.example secret-token HTTP 503' }), { status: 'failed', code: 'connection_rejected', httpStatus: 503 });
    results.push({ name: 'config-validation-and-error-redaction', status: 'passed' });
    return { results, methods };
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
async function main() {
  const args = process.argv.slice(2), self = args.length === 1 && args[0] === '--self-test';
  let report = { date: new Date().toISOString(), mode: self ? 'loopback-self-test' : 'real-service-read-only', status: 'failed', code: 'invalid_arguments' };
  let session, config;
  const output = path.resolve('docs/validation/2026-09-15-service');
  const artifact = path.join(output, self ? 'self-test.json' : 'connection-' + Date.now() + '.json');
  try {
    if (!self) {
      if (args.length !== 2 || args[0] !== '--config') throw new Error();
      report.code = 'invalid_config';
      config = validateConfig(JSON.parse(fs.readFileSync(args[1], 'utf8').replace(/^\uFEFF/, '')));
      report.provider = config.type;
    }
    report.code = 'browser_start_failed';
    session = await openExtension();
    report.browser = session.version; report.extensionVersion = session.extensionVersion;
    report.code = self ? 'self_test_failed' : 'connection_check_failed';
    if (self) report = { ...report, ...await selfTest(session.page), status: 'passed', code: 'self_test_passed' };
    else report = { ...report, ...summarize(await check(session.page, config)) };
  } catch { process.exitCode = 1; }
  finally {
    if (session) {
      try { await session.context.close(); }
      catch { report.status = 'failed'; report.code = 'browser_cleanup_failed'; }
    }
    report.remoteWritesExecuted = false;
    if (report.status !== 'passed') process.exitCode = 1;
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(artifact, JSON.stringify(report, null, 2) + '\n');
    console.log(report.status.toUpperCase() + ': ' + report.code);
  }
}
main().catch(() => { console.error('FAIL: runner_failed'); process.exitCode = 1; });
