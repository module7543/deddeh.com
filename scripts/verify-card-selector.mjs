// Exercise the Pages build at its production base. Run after npm run build:pages.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

const base = '/deddeh.com/';
const server = await preview({ base, preview: { host: '127.0.0.1', port: 0, strictPort: false } });
const address = 'http://127.0.0.1:' + server.httpServer.address().port + base;
const url = address + 'projects/apps/card-selector/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader'] });
const failures = [];
await mkdir('artifacts', { recursive: true });

async function swipe(page) {
  const box = await page.locator('.app-bar').boundingBox();
  const session = await page.context().newCDPSession(page);
  const y = box.y + 5, x = box.x + box.width * .78;
  for (const [type, dx] of [['touchStart', 0], ['touchMove', -35], ['touchMove', -92], ['touchEnd', 0]]) {
    await session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x + dx, y }] });
  }
  await session.detach();
}

try {
  for (const phone of [false, true]) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone, hasTouch: phone, reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', e => failures.push(e.message));
    page.on('request', r => { if (!r.url().startsWith(address) && !r.url().startsWith('data:')) failures.push(r.url()); });
    page.on('response', r => { if (r.status() >= 400) failures.push(r.status() + ' ' + r.url()); });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const viewer = page.locator('.wallet-viewer'), frame = viewer.locator('.frame');
    const tabs = viewer.locator('.tab'), play = viewer.locator('[data-transport]');
    const search = viewer.getByRole('searchbox'), button = name => viewer.getByRole('button', { name, exact: true });
    await expect(tabs).toHaveCount(5);
    await expect(play).toHaveText('Play tour');
    await expect(search).toHaveValue('Target');
    await expect(viewer.locator('.answer')).toContainText('11% after activation');
    await expect(page.locator('html')).toHaveClass(/has-field/);
    await page.screenshot({ path: 'artifacts/card-selector-' + (phone ? 'phone' : 'desktop') + '.png', fullPage: true });
    await frame.scrollIntoViewIfNeeded();
    await button('Dark').click();
    await expect(viewer.locator('.wallet-screen')).toHaveCSS('color-scheme', 'dark');
    await button('Phone').click();
    const narrow = await frame.boundingBox();
    await button('Desktop').click();
    const wide = await frame.boundingBox();
    assert(wide.width > narrow.width, 'The rails enclose the selected width');
    assert((await viewer.locator('.wallet-screen').evaluate(el => el.clientWidth)) >= 568, 'Wide mode lays out desktop content even on a phone');
    await button('Light').click();
    await expect(viewer.locator('.wallet-screen')).toHaveCSS('color-scheme', 'light');
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(viewer.locator('.caption')).toContainText('Ochre Fold earns 6%');
    await tabs.nth(2).click();
    await expect(viewer.locator('.merchant').first()).toContainText('Home Depot');
    await button('Filters').click();
    await expect(viewer.getByLabel('Sort by')).toHaveValue('dollar');
    await expect(button('Ready now')).toHaveAttribute('aria-pressed', 'true');
    await button('Done').click();
    await tabs.nth(3).click();
    await expect(viewer.locator('.fine-print')).toContainText('installation');
    await tabs.nth(4).click();
    await expect(viewer.locator('.pick-note')).toContainText('Juniper Reel earns 5%');
    if (phone) {
      await frame.scrollIntoViewIfNeeded();
      await swipe(page);
      await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true');
    }
    await tabs.nth(0).click();
    await play.click();
    await expect(play).toHaveText('Pause tour');
    await expect(search).toHaveValue('Target');
    await play.click();
    await expect(play).toHaveText('Play tour');
    await search.fill('Uber');
    await expect(play).toHaveText('Replay tour');
    await expect(viewer.locator('.merchant')).toContainText('Uber');
    await expect(viewer.locator('.offer-row')).toContainText('earn $5');
    await search.fill('no match');
    await expect(viewer.locator('.no-offers')).toBeVisible();
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => document.documentElement.clientWidth));
    await page.locator('.return').click();
    await expect(page.locator('.entry').first()).toContainText('CardSelector');
    await page.locator('.entry').first().click();
    await expect(tabs).toHaveCount(5);
    await page.goBack();
    await expect(page.locator('.entry')).toHaveCount(2);
    // Start the ordinary tour from a cold load and observe every chapter.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(url);
    await frame.scrollIntoViewIfNeeded();
    await expect(search).toHaveValue('Target', { timeout: 10000 });
    await expect(viewer.locator('.tour-pointer')).toHaveClass(/is-visible/);
    for (let i = 1; i < 5; i++) await expect(tabs.nth(i)).toHaveAttribute('aria-pressed', 'true', { timeout: 22000 });
    await expect(play).toHaveText('Replay tour', { timeout: 15000 });
    await expect(viewer.locator('.pick-note')).toContainText('Juniper Reel earns 5%');
    console.log((phone ? 'Phone' : 'Desktop') + ' passed the full tour and interactive checks.');
    await context.close();
  }
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
