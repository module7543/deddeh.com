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
    await play.click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.5);
    await play.click();
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
    await page.goBack();await expect(page.locator('.play')).toHaveAttribute('aria-pressed','false');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('audio').evaluate(a=>{a.currentTime=125});
    await expect(page.locator('.lyric-line.is-current')).toHaveText('Sweet on my tongue');
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
  await scene.close();
  const noGL = await browser.newPage();
  await noGL.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await noGL.route('**/*.analysis.json', route => route.abort());
  await noGL.goto(path); await expect(noGL.locator('.stage')).toHaveClass(/is-fallback/);
  await noGL.locator('.play').click(); await noGL.waitForFunction(() => document.querySelector('audio').currentTime > .2);
  await noGL.locator('audio').evaluate(a => { a.currentTime = 125; });
  await expect(noGL.locator('.lyric-line.is-current')).toHaveText('Sweet on my tongue');
  await noGL.close();
  console.log('PASS frozen/moving relief and WebGL/analysis failure fallback');

} finally { await browser.close(); }
