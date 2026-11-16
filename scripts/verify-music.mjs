import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
const base = process.env.PREVIEW_URL ?? 'http://localhost:4174/deddeh.com/';
const cues = JSON.parse(readFileSync('public/music/sweet-on-my-tongue.lyrics.json')).cues;
const path = `${base}projects/music/sweet-on-my-tongue/`;
mkdirSync('artifacts', {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  for (const mobile of [false,true]) {
    const page = await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
    await page.goto(path); await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('html')).toHaveClass(/has-field/);
    await expect(page.locator('.lyric-line')).toHaveCount(4);
    assert(await page.locator('audio').evaluate(a=>a.paused));
    assert((await page.locator('audio').evaluate(a=>a.currentSrc)).includes('/deddeh.com/audio/'));
    const play=page.locator('.play');
    const titleWidth = await page.locator('h1').evaluate(el => el.getBoundingClientRect().width);
    await page.evaluate(() => { window.reviewCanvas = document.querySelector('.stage canvas'); });
    // The quiet amplitude timeline retains 80 seek positions.
    await expect(page.locator('.scrub-bars i')).toHaveCount(80);
    await expect(page.locator('.tracks')).toHaveCount(0);
    await expect(page.locator('#room')).not.toHaveClass(/is-playing|is-held/);
    await play.click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.5);
    await expect(page.locator('#room')).toHaveClass(/is-playing/);
    await expect.poll(() => page.locator('h1').evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(titleWidth * .9);
    await page.locator('.sound').click();
    assert(await page.locator('audio').evaluate(a => a.muted));
    await page.locator('.sound').click();
    assert(!(await page.locator('audio').evaluate(a => a.muted)));
    await expect(page.locator('.scrub-bars i.is-past').first()).toBeVisible();
    await play.click();
    await expect(page.locator('#room')).toHaveClass(/is-held/);
    await expect(page.locator('#room')).not.toHaveClass(/is-playing/);
    const paused=await page.locator('audio').evaluate(a=>a.currentTime);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('audio').evaluate(a=>a.currentTime),paused);
    // Every line, all repeated refrains, and backward seeks against actual decoded media.
    for (const cue of [...cues].reverse()) {
      await page.locator('audio').evaluate((a,t)=>{a.currentTime=t},cue.start+.15);
      await expect(page.locator('.lyric-line.is-current')).toHaveText(cue.text);
    }
    for(const t of [5,80,148,204]) {
      await page.locator('audio').evaluate((a,t)=>{a.currentTime=t},t);
      await expect(page.locator('.lyric-line.is-current')).toHaveCount(0);
      await expect(page.locator('.lyric-status')).toHaveText('Instrumental');
    }
    await page.locator('audio').evaluate(a=>{a.currentTime=48.4});
    await play.click();await page.waitForTimeout(800);await play.click();
    await expect(page.locator('.lyric-line.is-current')).toHaveText('Sweet on my tongue');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`artifacts/sweet-${mobile?'mobile':'desktop'}.png`,fullPage:true});
    const range=page.getByRole('slider',{name:'Position in the track'});
    await range.focus();await range.press('Home');
    await expect(page.locator('.now')).toHaveText('0:00');
    await range.press('End');await expect(page.locator('.now')).toHaveText('3:26');
    await page.locator('summary').click();
    await expect(page.locator('.lyric-seek')).toHaveCount(32);
    await page.locator('.lyric-seek').nth(20).click();
    await expect(page.locator('.lyric-line.is-current')).toHaveText('Sweet on my tongue');
    await page.locator('.close-lyrics').click();
    await expect(page.locator('summary')).toBeFocused();
    // Browser history and destruction: leaving an active track must stop it.
    await play.click();await page.locator('.return').click();
    await expect(page.locator('.setlist .entry')).toHaveCount(1);
    assert(await page.evaluate(() => document.querySelector('.stage canvas') === window.reviewCanvas), 'The same canvas survives navigation');
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.music-heading h1')).toHaveText('Music.');
    await expect(page.locator('.setlist .entry')).toHaveClass(/is-shown/);
    await expect(page.locator('.figure-text')).toContainText('Sweet on My Tongue');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`artifacts/music-${mobile?'mobile':'desktop'}.png`,fullPage:true});
    await page.goBack();await expect(page.locator('.play')).toHaveAttribute('aria-pressed','false');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('audio').evaluate(a=>{a.currentTime=125});
    await expect(page.locator('.lyric-line.is-current')).toHaveText('Sweet on my tongue');
    await expect(page.locator('h1')).toHaveCSS('transform', 'none');
    // Mobile and narrow viewport overflow; actual mobile hardware remains a separate review.
    if(mobile){for(const width of [320,375,768]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}}
    assert.deepEqual(errors,[]);
    console.log(`PASS ${mobile?'mobile':'desktop'}: recording, 32 cues, rests, keyboard seeks, pause/resume, full lyrics, history, reduced motion, no overflow/errors`);
    await page.close();
  }
  const fail = await browser.newPage();
  await fail.route('**/audio/*.mp3',route=>route.abort());
  await fail.goto(path);await fail.locator('.play').click();
  await expect(fail.locator('.player-error')).toBeVisible();
  await fail.unroute('**/audio/*.mp3');await fail.locator('.play').click();
  await fail.waitForFunction(()=>document.querySelector('audio').currentTime>.2);
  await expect(fail.locator('.player-error')).toBeHidden();await fail.close();
  const fallback=await browser.newPage({javaScriptEnabled:false});await fallback.goto(path);
  await expect(fallback.locator('audio[controls]')).toBeVisible();await fallback.locator('summary').click();await expect(fallback.locator('.written-line')).toHaveCount(32);await fallback.close();
  console.log('PASS audio error/retry and no-JavaScript playback/text');
  const scene = await browser.newPage({viewport:{width:1440,height:900}});
  await scene.goto(path); await scene.waitForSelector('.lyric-line');
  await scene.locator('audio').evaluate(a => { a.currentTime = 49; });
  await scene.waitForTimeout(3500); // finish entrance/lighting transitions before comparing the paused sculpture
  // Compare only the sculpture: the site's identity caret intentionally blinks.
  const frozen = await scene.locator('.sheet-slot').screenshot();
  await scene.waitForTimeout(350);
  assert(frozen.equals(await scene.locator('.sheet-slot').screenshot()), 'Paused relief is still');
  await scene.locator('.play').click(); await scene.waitForTimeout(500);
  const first = await scene.locator('.sheet-slot').screenshot(); await scene.waitForTimeout(500);
  assert(!first.equals(await scene.locator('.sheet-slot').screenshot()), 'Actual playback changes the relief');
  // On Pause the relief falls back to the resting sculpture and is still again.
  await scene.locator('.play').click(); await scene.waitForTimeout(3000);
  const rested = await scene.locator('.sheet-slot').screenshot(); await scene.waitForTimeout(350);
  assert(rested.equals(await scene.locator('.sheet-slot').screenshot()), 'Paused relief settles and is still');
  // With a second entry in the collection (served to this test only), the song page links to it by itself.
  await scene.route('**/projects/music/', async route => { const r = await route.fetch(); route.fulfill({ response: r, body: (await r.text()).replace('</ol>', '<li><a class="entry" href="./test-only/" data-room><span class="entry-no">02</span><span class="entry-name">Test Only</span></a></li></ol>') }); });
  await scene.reload();
  await expect(scene.locator('.tracks .track-step[rel="next"]')).toHaveAttribute('href', '../test-only/');
  await expect(scene.locator('.tracks .track-step[rel="prev"]')).toHaveCount(0);
  await scene.close();
  // Future collection: multiple entries, long titles and a second musical character.
  // These are test-only fixtures, never public recordings.
  const catalogue = await browser.newPage({viewport:{width:1440,height:900}});
  const alternate = JSON.parse(readFileSync('public/music/sweet-on-my-tongue.analysis.json'));
  alternate.overview = alternate.overview.map((row, i) => row.map((v, band) => band < 2 ? v : (i + band) % 4 === 0 ? 240 : 20));
  await catalogue.route('**/alternate.analysis.json', route => route.fulfill({json:alternate}));
  await catalogue.route('**/projects/music/', async route => {
    const response = await route.fetch();
    const entry = '<li><a class="entry" href="./test-only/" data-room data-analysis="../../music/alternate.analysis.json"><span class="entry-no">02</span><span class="entry-name">A longer title for another kind of recording</span><span class="entry-time">12:34</span><span class="entry-go">↗</span></a></li>';
    await route.fulfill({response, body:(await response.text()).replace('</ol>', entry + '</ol>')});
  });
  await catalogue.goto(`${base}projects/music/`);
  await expect(catalogue.locator('.entry.is-shown .entry-no')).toHaveText('01');
  await catalogue.locator('.entry').nth(1).focus();
  await expect(catalogue.locator('.entry.is-shown .entry-no')).toHaveText('02');
  await expect(catalogue.locator('.figure-text')).toContainText('A longer title');
  await catalogue.locator('.entry').first().focus();
  await expect(catalogue.locator('.entry.is-shown .entry-no')).toHaveText('01');
  for (const width of [320, 390, 768, 820, 821, 1024, 1440]) {
    await catalogue.setViewportSize({width, height:844});
    assert(await catalogue.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Collection overflow at ${width}`);
    const bounds = await catalogue.locator('.entry').nth(1).boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
  }
  await catalogue.close();
  console.log('PASS multi-recording focus previews, long titles and collection widths 320–1440');
  const noGL = await browser.newPage();
  await noGL.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await noGL.route('**/*.analysis.json', route => route.abort());
  await noGL.goto(path); await expect(noGL.locator('.stage')).toHaveClass(/is-fallback/);
  await noGL.locator('.play').click(); await noGL.waitForFunction(() => document.querySelector('audio').currentTime > .2);
  await noGL.locator('audio').evaluate(a => { a.currentTime = 125; });
  await expect(noGL.locator('.lyric-line.is-current')).toHaveText('Sweet on my tongue');
  await noGL.close();
  console.log('PASS frozen/moving/settled relief, derived next link and WebGL/analysis failure fallback');

} finally { await browser.close(); }
