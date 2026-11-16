// Layout and navigation checks for the V3 environment; fixtures never enter the catalogue.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = process.env.PREVIEW_URL ?? 'http://localhost:4174/deddeh.com/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const noOverflow = async page => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${page.viewportSize().width}px`);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}projects/music/`);
  await expect(page.locator('.entry.is-shown')).toHaveCount(1);
  await expect(page.locator('.stage canvas')).toHaveCount(1);
  const canvas = await page.locator('.stage canvas').elementHandle();
  const collectionSlot = await page.locator('.sheet-slot').boundingBox();
  await page.locator('.entry').click();
  await expect(page.locator('.lyric-line')).toHaveCount(4);
  assert(await canvas.evaluate(node => node === document.querySelector('.stage canvas')), 'Navigation keeps the same renderer');
  const songSlot = await page.locator('.sheet-slot').boundingBox();
  assert(songSlot.x < collectionSlot.x - 300, 'The sculpture crosses from the collection to the listening layout');
  await page.locator('.play').click();
  await expect(page.locator('.listening-state')).toHaveText('Now playing');
  await page.waitForTimeout(1300);
  const titleScale = await page.locator('h1').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
  const lyricScale = await page.locator('.live-lyrics').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
  assert(titleScale < .7 && lyricScale > 1.1, 'Title yields to the lyrics');
  await page.getByRole('slider', { name: 'Position in the track' }).fill('49');
  await expect(page.locator('.lyric-line.is-current')).toHaveText('Sweet on my tongue');
  await page.locator('.play').click();
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('h1').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a), 1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.play').click();
  assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).transform), 'none');
  await page.locator('.play').click();
  await page.locator('.return').click();
  await expect(page.locator('.music-heading')).toBeVisible();
  assert(await canvas.evaluate(node => node === document.querySelector('.stage canvas')));
  for (const width of [320, 375, 390, 768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    const entry = await page.locator('.entry').boundingBox();
    assert(entry.height >= 44);
  }
  await page.locator('.music-foot a').click();
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'apps');
  await expect(page.locator('.manifest')).toBeVisible();
  await page.close();
  console.log('PASS canvas continuity, sculpture relocation, title/lyric choreography, reduced motion, 320–1440 collection layouts, Apps return');

  const future = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const second = '<li><a class="entry" href="./test-only/" data-room data-analysis="../../music/test-only.analysis.json"><span class="entry-no">02</span><span class="entry-name">A deliberately longer title for a future recording</span><span class="entry-time">4:10</span><span class="entry-invitation">Listen</span></a></li>';
  await future.route('**/projects/music/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/(<ol class="setlist">[\s\S]*?)(<\/ol>)/, `$1${second}$2`) });
  });
  let releaseFirst, releaseSecond;
  const firstReady = new Promise(resolve => { releaseFirst = resolve; });
  const secondReady = new Promise(resolve => { releaseSecond = resolve; });
  const analysis = readFileSync('public/music/sweet-on-my-tongue.analysis.json', 'utf8');
  await future.route('**/*.analysis.json', async route => {
    await (route.request().url().includes('test-only') ? secondReady : firstReady);
    await route.fulfill({ contentType: 'application/json', body: analysis });
  });
  await future.goto(`${base}projects/music/`);
  await expect(future.locator('.recording-count')).toHaveText('02');
  await future.locator('.entry').nth(1).focus();
  releaseFirst();
  await future.waitForTimeout(300);
  await expect(future.locator('.entry').first()).not.toHaveClass(/is-shown/);
  releaseSecond();
  await expect(future.locator('.entry').nth(1)).toHaveClass(/is-shown/);
  await expect(future.locator('.figure-text')).toContainText('A deliberately longer title');
  for (const width of [320, 390, 768, 1440]) { await future.setViewportSize({ width, height: 900 }); await noOverflow(future); }
  await future.close();
  console.log('PASS future catalogue fixture, long titles, focus selection while analysis downloads out of order');
} finally { await browser.close(); }
