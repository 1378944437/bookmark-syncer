// Run through: node scripts/verify-extension.cjs --interruption
const assert = require('node:assert/strict');
module.exports = async function verifyInterruption({ device, add, send, state, bookmarks,
  expectSuccess, config, holdPut, files, requests, until, pause, pass }) {
  let a = await device('interruption');
  await add(a.page, 'survives-migration-crash');
  const old = { enabled: true, passphrase: 'old-test-password' };
  const next = { enabled: true, passphrase: 'new-test-password' };
  expectSuccess(await send(a.page, { type: 'sync:encryption', config, next: old }));
  // Chromium can buffer bookmark writes; establish a persisted baseline before injecting a crash.
  await a.context.close();
  a = await device('interruption-persisted', a.profile);
  assert.deepEqual((await bookmarks(a.page)).map(n => n.title), ['survives-migration-crash']);
  const before = await state(a.page), oldFiles = new Map(files);
  const hold = holdPut(true);
  const sending = send(a.page, { type: 'sync:encryption', config, next }).catch(() => null);
  await until(() => hold.path);
  const pendingBefore = (await state(a.page)).encryption_migration;
  assert.equal(pendingBefore.path, hold.path.replace('/dav/', ''));
  assert(files.has(hold.path), 'Server must commit before interrupting the browser');
  const cdp = await a.context.browser().newBrowserCDPSession();
  console.log('CRASH browser after server commit and before response');
  await Promise.race([cdp.send('Browser.crash').catch(() => {}), pause(3000)]);
  hold.release();
  await Promise.race([sending, pause(1000)]);
  await Promise.race([a.context.close().catch(() => {}), pause(3000)]);

  const b = await device('interruption-reopen', a.profile);
  const stored = await state(b.page);
  assert.deepEqual((await bookmarks(b.page)).map(n => n.title), ['survives-migration-crash']);
  assert.equal(stored.e2e_passphrase, old.passphrase);
  assert.deepEqual(stored.encryption_migration, pendingBefore);
  assert.equal(stored.syncState.basis.filePath, before.syncState.basis.filePath);
  assert.equal(stored.sync_lock.holder, 'encryption');
  const locked = await send(b.page, { type: 'sync:encryption', config, next });
  assert.equal(locked.success, false); assert.match(locked.message, /进行中/);
  pass('migration-crash-preserves-old-settings-pending-candidate-and-lock');

  const expires = stored.sync_lock.timestamp + 300000;
  while (Date.now() <= expires + 100) {
    const remaining = expires + 101 - Date.now();
    console.log('WAIT natural crash-lock expiry: ' + Math.ceil(remaining / 1000) + ' seconds');
    await pause(Math.min(remaining, 30000));
  }
  const putsBeforeResume = requests.filter(r => r.method === 'PUT').length;
  const candidate = files.get(hold.path);
  files.set(hold.path, { ...candidate, content: candidate.content + 'corrupted' });
  const rejected = await send(b.page, { type: 'sync:encryption', config, next });
  assert.equal(rejected.success, false); assert.match(rejected.message, /校验失败/);
  assert.equal((await state(b.page)).e2e_passphrase, old.passphrase);
  assert((await state(b.page)).encryption_migration);
  assert.equal(requests.filter(r => r.method === 'PUT').length, putsBeforeResume);
  pass('corrupt-migration-candidate-rejected-after-natural-lock-expiry', {
    elapsedSinceLockMs: Date.now() - stored.sync_lock.timestamp
  });

  files.set(hold.path, candidate);
  const blocked = await send(b.page, { type: 'sync:push', config });
  assert.equal(blocked.success, false); assert.match(blocked.message, /加密迁移/);
  // A changed form value must not replace the already-persisted migration intent.
  expectSuccess(await send(b.page, { type: 'sync:encryption', config, next: { enabled: false, passphrase: '' } }));
  const resumed = await state(b.page);
  assert.equal(resumed.e2e_enabled, true);
  assert.equal(resumed.e2e_passphrase, next.passphrase);
  assert.equal(resumed.encryption_migration, undefined);
  assert.equal(resumed.sync_lock, undefined);
  assert.equal(resumed.syncState.basis.filePath, pendingBefore.path);
  assert.equal(requests.filter(r => r.method === 'PUT').length, putsBeforeResume);
  for (const [name, content] of oldFiles) assert.deepEqual(files.get(name), content);
  assert.deepEqual((await bookmarks(b.page)).map(n => n.title), ['survives-migration-crash']);
  pass('migration-resumes-original-intent-without-reupload-or-history-loss');
};
