import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.PREVIEW_URL;
assert.equal(url, 'https://module7543.github.io/deddeh.com/', 'Verify only the repository preview URL');
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const failures = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('requestfailed', (request) => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    assert.equal(response.status(), 200);
    assert.equal(page.url(), url, 'The preview must not redirect to a custom domain');
    await page.evaluate(() => document.fonts.ready);
    const writing = page.getByRole('button', { name: /Writing/ });
    const projects = page.getByRole('button', { name: /Projects/ });
    const notes = page.getByRole('button', { name: /Notes/ });
    const readout = page.locator('.readout-text');
    await expect(readout).toHaveText('Unwritten');
    if (mobile) await writing.tap(); else await writing.click();
    await expect(writing).toHaveAttribute('aria-pressed', 'true');
    await expect(readout).toHaveText('Writing');
    await projects.click();
    await expect(writing).toHaveAttribute('aria-pressed', 'false');
    await expect(readout).toHaveText('Projects');
    await notes.focus();
    await notes.press('Enter');
    await expect(page.locator('.detail')).toContainText('Notes');
    await notes.press('Escape');
    await expect(notes).toHaveAttribute('aria-pressed', 'false');
    await writing.focus();
    await writing.press('ArrowDown');
    await expect(projects).toBeFocused();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'No horizontal overflow');
    if (!mobile) {
      await page.mouse.move(700, 600);
      await notes.hover();
      await expect(notes).toHaveClass(/is-active/);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/pages-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    console.log(`PASS ${mobile ? 'mobile touch/reduced motion' : 'desktop hover/keyboard'}: HTTP 200, assets, pin/unpin, readout, Escape, arrow navigation, no overflow — ${url}`);
    await context.close();
  }
  assert.deepEqual(failures, [], 'No failed assets or JavaScript page errors');
} finally {
  await browser.close();
}
