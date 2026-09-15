// Real unpacked Edge extension, disposable profile, synthetic local settings only.
// MARKSYNC_PLAYWRIGHT=<Playwright module path> node scripts/verify-settings-scroll.cjs [--baseline]
const { chromium } = require(process.env.MARKSYNC_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const extension = path.resolve('apps/chrome-extension/dist');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
const id = crypto.createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex')
  .slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const baseline = process.argv.includes('--baseline');
const output = path.resolve('docs/validation/2026-09-15-settings-scroll');
const results = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function geometry(locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    let top = 0, bottom = innerHeight, left = 0, right = innerWidth;
    const clips = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p), b = p.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) {
        top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom);
        clips.push({ overflow: s.overflowY, height: p.clientHeight, content: p.scrollHeight, scroll: p.scrollTop });
      }
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
        left = Math.max(left, b.left); right = Math.min(right, b.right);
      }
    }
    const visible = r.top >= top - 1 && r.bottom <= bottom + 1 && r.left >= left - 1 && r.right <= right + 1;
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { visible, hit: !!hit && el.contains(hit), top: r.top, bottom: r.bottom,
      left: r.left, right: r.right, bounds: { top, bottom, left, right }, clips };
  });
}
async function reach(page, locator, name, details) {
  // Wheel over the visible form. Do not use scrollIntoView/click auto-scroll:
  // those can programmatically scroll overflow:hidden and hide this regression.
  const viewport = page.viewportSize();
  await page.mouse.move(details.fullTab ? viewport.width / 2 : Math.min(viewport.width - 40, 260),
    (details.fullTab ? viewport.height : Math.min(viewport.height, 560)) - 70);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 700); await pause(60); }
  const state = await geometry(locator);
  results.push({ name, ...details, ...state });
  if (!baseline) assert(state.visible && state.hit, `${name}: bottom control is clipped: ${JSON.stringify(state)}`);
  return state;
}
async function checkTheme(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto(`chrome-extension://${id}/index.html`);
  for (const system of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: system });
    for (const selected of ['dark', 'light', 'system']) {
      await page.evaluate(theme => chrome.storage.local.set({ theme }), selected);
      const expected = selected === 'system' ? system : selected;
      await page.waitForFunction(expected => getComputedStyle(document.documentElement).colorScheme === expected, expected);
      const colors = await page.evaluate(() => ({
        scheme: getComputedStyle(document.documentElement).colorScheme,
        background: getComputedStyle(document.documentElement).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
        meta: document.querySelector('meta[name="theme-color"]').content,
        metaCount: document.querySelectorAll('meta[name="theme-color"]').length,
        media: document.querySelector('meta[name="theme-color"]').getAttribute('media'),
      }));
      assert.equal(colors.meta, colors.background);
      assert.equal(colors.body, colors.background);
      assert.equal(colors.metaCount, 1);
      assert.equal(colors.media, null);
      results.push({ name: 'theme-chrome-hints', system, selected, ...colors });
    }
  }
  await page.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));
  await page.close();
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'marksync-scroll-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    if (!baseline) await checkTheme(context);
    const cases = baseline ? [[360, 560, false]] : [
      [360, 560, false], [320, 420, false], [412, 740, false], [360, 280, false],
      [1280, 720, true], [390, 560, true],
    ];
    for (const language of baseline ? ['en'] : ['en', 'zh-CN']) {
      const zh = language === 'zh-CN';
      for (const [width, height, fullTab] of cases) {
        const page = await context.newPage();
        await page.setViewportSize({ width, height });
        await page.goto(`chrome-extension://${id}/index.html${fullTab ? '?mode=tab' : ''}`);
        await page.evaluate(language => chrome.storage.local.set({ app_language: language, auto_sync_enabled: false,
          scheduled_sync_enabled: false, storage_type: 'webdav' }), language);
        await page.reload();
        const settings = fullTab ? (zh ? '设置与工具' : 'Settings & Tools') : (zh ? '设置' : 'Settings');
        await page.getByRole('button', { name: settings, exact: true }).click();
        await pause(500);
        if (!fullTab) await page.getByText(zh ? '云端存储服务' : 'Cloud Storage Services', { exact: true }).click();
        await page.locator('#webdav-url').waitFor();
        await pause(500);
        await page.locator('#webdav-url').fill('https://dav.jianguoyun.com/dav/');
        const details = { language, width, height, fullTab };
        const test = page.getByRole('button', { name: zh ? '测试当前输入' : 'Test these inputs', exact: true });
        await reach(page, test, 'webdav-test', details);
        if (!baseline) {
          const save = page.getByRole('button', { name: zh ? '保存连接配置' : 'Save connection settings', exact: true });
          const state = await geometry(save);
          assert(state.visible && state.hit, 'Save button must be fully visible at the bottom');
          // Verify keyboard can traverse the form to its final action without invoking network operations.
          await page.locator('#webdav-password').focus();
          for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
          assert(await test.evaluate(el => el === document.activeElement), 'Tab must reach the final action');
        }
        if (width === 360 && height === 560) {
          await page.screenshot({ path: path.join(output, baseline ? 'before.png' : `after-${language}.png`) });
        }
        if (!baseline) {
          await page.getByRole('button', { name: 'GitHub Gist', exact: true }).click();
          await page.locator('#gist-token').fill('synthetic-layout-test-token');
          await page.getByRole('button', { name: /Advanced options|展开高级选项/ }).click();
          await reach(page, page.getByRole('button', { name: zh ? '测试 Gist 连通性' : 'Test Gist Connection', exact: true }),
            'gist-advanced-test', details);
        }
        console.log(`PASS ${language} ${width}x${height} ${fullTab ? 'tab' : 'popup'}`);
        await page.close();
      }
    }
  } finally {
    fs.writeFileSync(path.join(output, baseline ? 'baseline.json' : 'results.json'), JSON.stringify({
      version: manifest.version, browser: context.browser().version(), results }, null, 2) + '\n');
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
