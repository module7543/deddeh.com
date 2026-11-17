import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://localhost:4175/deddeh.com/';
assert(/^http:\/\/(localhost|127\.0\.0\.1):\d+\/(deddeh\.com\/)?$/.test(base), 'Verify a local branch build');
const article = `${base}writing/the-margin/`;
const output = 'docs/review/reading-comfort';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), ignoreDefaultArgs: ['--disable-back-forward-cache'] });
const report = { baseline: [], sizes: [], contrast: {}, proof: [], checks: [] }, errors = [];
const context = async options => {
  const ctx = await browser.newContext(options);
  await ctx.route('https://formspree.io/**', route => route.abort());
  ctx.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  return ctx;
};
const ready = async page => {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#essay')).toHaveCSS('opacity', '1');
};
// Real viewport input avoids Playwright scrolling a sticky control into view.
const click = async (page, selector) => { const b = await page.locator(selector).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const open = async page => { if (await page.locator('.reading-slip').isHidden()) await click(page, '.reading-toggle'); };
const mode = async (page, value) => {
  await open(page); await page.locator(`[data-mode="${value}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', value);
  await expect(page.locator('html')).not.toHaveClass(/is-switching-mode/);
};
const size = async (page, value) => {
  await open(page); await page.locator(`[data-size="${value}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-reading-size', value);
};
const capture = async (page, name) => {
  await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: `${output}/${name}.jpg`, type: 'jpeg', quality: 88, animations: 'disabled' });
};
const geometry = page => page.evaluate(() => [...document.querySelectorAll('.essay, .essay-head, .essay h1, .dek, .meta, .prose, .prose > *, .note, .after')].map(n => {
  const r = n.getBoundingClientRect(), s = getComputedStyle(n);
  return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, font: s.font, spacing: s.letterSpacing };
}));
function luminance(color) {
  const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
async function checkContrast(page, appearance) {
  const values = await page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    return [...document.querySelectorAll('.reading-toggle, .reading-summary, .reading-label, .reading-caption, .mode-face, .size-options button, .size-specimen, .prose, .note')].map(n => {
      const s = getComputedStyle(n);
      let surface = bg;
      for (let p = n; p; p = p.parentElement) {
        const c = getComputedStyle(p).backgroundColor;
        if (c !== 'rgba(0, 0, 0, 0)') { surface = c; break; }
      }
      // The selected size's translucent tint is composited on the page.
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = surface; ctx.fillRect(0, 0, 1, 1);
      const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      return { name: n.className || n.textContent.trim(), color: s.color, bg: `rgb(${rgb.join(',')})` };
    });
  });
  report.contrast[appearance] = values.map(v => ({ name: v.name, ratio: +contrast(v.color, v.bg).toFixed(2) }));
  for (const v of report.contrast[appearance]) assert(v.ratio >= 4.5, `${appearance} ${v.name} contrast ${v.ratio}`);
}
try {
  for (const width of [320, 390, 600, 601, 820, 1100, 1440]) {
    const ctx = await context({ viewport: { width, height: 900 }, hasTouch: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); await page.goto(article); await ready(page);
    const original = await geometry(page);
    if (process.env.BASELINE_URL) {
      const ref = await ctx.newPage(); await ref.goto(`${process.env.BASELINE_URL}writing/the-margin/`); await ready(ref);
      assert.deepEqual(await geometry(ref), original, `Original geometry matches PR #14 at ${width}`);
      const clip = { x: 0, y: 80, width, height: 820 };
      assert((await ref.screenshot({ clip, animations: 'disabled' })).equals(await page.screenshot({ clip, animations: 'disabled' })), `Original pixels match PR #14 at ${width}`);
      await mode(page, 'ink'); await page.keyboard.press('Escape');
      await ref.evaluate(() => { localStorage.setItem('deddeh:reading-mode', 'ink'); }); await ref.reload(); await ready(ref);
      assert.deepEqual(await geometry(ref), await geometry(page));
      assert((await ref.screenshot({ clip, animations: 'disabled' })).equals(await page.screenshot({ clip, animations: 'disabled' })), `Dark Original pixels match at ${width}`);
      report.baseline.push(`${width}px: both palettes, all article geometry and pixels below masthead match c55df7b5`);
      await ref.close(); await mode(page, 'paper');
    }
    for (const choice of ['original', 'larger', 'largest', 'original']) {
      await size(page, choice);
      const metrics = await page.evaluate(() => {
        const font = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
        const visible = [...document.querySelectorAll('.reading-preferences button')].map(n => n.getBoundingClientRect().toJSON());
        const all = [...document.querySelectorAll('.prose, .prose > *, .note, .reading-slip, .top > :not(.marks)')].map(n => n.getBoundingClientRect().toJSON());
        return { body: font('.prose'), heading: font('.prose h2'), note: font('.note'), title: font('h1'), visible, all, width: innerWidth };
      });
      const scale = { original: 1, larger: 1.15, largest: 1.3 }[choice];
      assert(Math.abs(metrics.body - (width <= 820 ? 19 : 21) * scale) < .01);
      assert(Math.abs(metrics.note - 13 * scale) < .01);
      assert(metrics.heading > metrics.body, 'Hierarchy survives');
      for (const b of metrics.visible) assert(b.width >= 44 && b.height >= 44, `${width}: 44px targets`);
      for (const b of metrics.all) assert(b.x >= -1 && b.right <= width + 1, `${width} ${choice}: actual boxes fit (not just clipped overflow)`);
      const header = await page.locator('.top > :not(.marks)').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()));
      for (let i = 1; i < header.length; i++) assert(header[i].left >= header[i - 1].right, `${width}: header controls do not overlap`);
      assert(await page.evaluate(() => [...document.querySelectorAll('.prose p, .prose h2, .note')].every(n => n.scrollWidth <= n.clientWidth + 1 || getComputedStyle(n).display === 'inline')), `${width}: text does not overflow`);
      report.sizes.push({ width, choice, body: metrics.body, note: metrics.note, heading: metrics.heading });
      if (choice === 'original') assert.deepEqual(await geometry(page), original, 'Reset recovers original composition');
    }
    // Native keyboard sequence, expanded state and a normal, untrapped exit.
    await page.keyboard.press('Escape'); await expect(page.locator('.reading-toggle')).toBeFocused();
    await page.keyboard.press('Enter');
    for (const selector of ['[data-mode="paper"]', '[data-mode="ink"]', '[data-size="original"]', '[data-size="larger"]', '[data-size="largest"]', '.return']) {
      await page.keyboard.press('Tab'); await expect(page.locator(selector)).toBeFocused();
    }
    await expect(page.locator('.reading-slip')).toBeHidden();
    await open(page); await page.locator('[data-size="larger"]').tap();
    await expect(page.locator('[data-size="larger"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-mode="ink"]').tap(); await page.locator('[data-mode="ink"]').tap();
    await expect(page.locator('[data-mode="ink"]')).toHaveAttribute('aria-pressed', 'true');
    await page.reload(); await ready(page);
    await expect(page.locator('html')).toHaveAttribute('data-reading-size', 'larger');
    await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'ink');
    await ctx.close();
  }
  report.checks.push('320–1440px: all sizes, both appearances, baseline equality, touch, keyboard, reset, reload');
  console.log('PASS responsive sizes, Original baseline, touch and keyboard');

  for (const width of [390, 1440]) {
    const ctx = await context({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    const page = await ctx.newPage(); await page.goto(article); await ready(page);
    const device = width === 390 ? 'mobile' : 'desktop';
    await capture(page, `${device}-original`);
    for (const appearance of ['paper', 'ink']) {
      await mode(page, appearance); await size(page, 'largest');
      await checkContrast(page, appearance);
      await capture(page, `${device}-${appearance}-slip`);
      await page.keyboard.press('Escape');
      await page.evaluate(() => scrollTo(0, document.querySelector('#work').getBoundingClientRect().top + scrollY - 110));
      await capture(page, `${device}-${appearance}-largest`);
      // Keep a real word near the top of the reading area, even after many paragraphs reflow.
      await page.evaluate(() => {
        const node = document.querySelector('#readers').nextElementSibling.firstChild;
        const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 3);
        scrollTo(0, range.getBoundingClientRect().top + scrollY - 150);
        window.testWord = range;
      });
      await open(page);
      const before = await page.evaluate(() => testWord.getBoundingClientRect().top);
      // Click at viewport coordinates; locator.click scrolls the sticky header itself.
      const b = await page.locator('[data-size="original"]').boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      const after = await page.evaluate(() => testWord.getBoundingClientRect().top);
      assert(Math.abs(after - before) <= 2, `Word stays in place: ${width}, ${before} -> ${after}`);
      await page.keyboard.press('Escape'); await page.evaluate(() => scrollTo(0, 0));
    }
    await open(page); await page.locator('[data-size="largest"]').focus();
    await page.setViewportSize({ width: width === 390 ? 1440 : 320, height: 844 });
    await expect(page.locator('[data-size="largest"]')).toBeFocused();
    await page.keyboard.press('Space'); await expect(page.locator('html')).toHaveAttribute('data-reading-size', 'largest');
    await ctx.close();
  }
  report.checks.push('Desktop/mobile word anchor, visual captures, contrast, focus across viewport changes');
  console.log('PASS reading-place retention and contrast');

  // Both sizes and palettes must refresh an already prepared iframe, then survive Back/Forward.
  for (const [appearance, scale] of [['paper', 'larger'], ['ink', 'largest']]) {
    const ctx = await context({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function(key) { if (key === 'deddeh:proof') window.arrival = JSON.parse(this.getItem(key)); return remove.call(this, key); };
    });
    const page = await ctx.newPage(); await page.goto(`${base}#writing`);
    await expect(page.locator('html')).toHaveClass(/has-field/);
    await expect.poll(() => page.evaluate(() => { const d = document.querySelector('.proof-frame')?.contentDocument; return d?.readyState === 'complete' && d.fonts.status === 'loaded'; })).toBe(true);
    await page.evaluate(([m, s]) => { localStorage.setItem('deddeh:reading-mode', m); localStorage.setItem('deddeh:reading-size', s); }, [appearance, scale]);
    await page.locator('.essay-link').first().click(); await page.waitForURL(article); await ready(page);
    const payload = await page.evaluate(() => {
      const lead = document.querySelector('.lead'), range = document.createRange();
      range.setStart(lead.firstChild, 0); range.setEnd(lead.firstChild, 5);
      const r = range.getBoundingClientRect(), h = parseFloat(getComputedStyle(lead).fontSize) * .46;
      return { arrival, word: { x: r.x, y: r.y + r.height / 2 - h / 2, h } };
    });
    assert.equal(payload.arrival.mode, appearance); assert.equal(payload.arrival.size, scale);
    assert(payload.arrival.bars.some(b => Math.abs(b[0] - payload.word.x) < .11 && Math.abs(b[1] - payload.word.y) < .11 && Math.abs(b[3] - payload.word.h) < .11), 'Enlarged first word lands on its measured proof bar');
    report.proof.push({ appearance, scale, bars: payload.arrival.bars.length, firstWordAligned: true });
    await page.goBack({ waitUntil: 'commit' }); await expect(page.locator('html')).not.toHaveClass(/is-proofing/);
    await page.goForward({ waitUntil: 'commit' }); await ready(page); await expect(page.locator('html')).not.toHaveClass(/is-leaving/);
    await expect(page.locator('html')).toHaveAttribute('data-reading-size', scale);
    await ctx.close();
  }
  const stale = await context();
  await stale.addInitScript(() => {
    if (location.protocol !== 'http:') return; // the initial about:blank has no storage origin
    localStorage.setItem('deddeh:reading-size', 'largest');
    sessionStorage.setItem('deddeh:proof', JSON.stringify({ at: Date.now(), w: innerWidth, h: innerHeight, mode: 'paper', size: 'original', bars: [[10, 10, 30, 10, 0]] }));
    window.staleBarsShown = false;
    new MutationObserver(records => {
      if (records.some(r => [...r.addedNodes].some(n => n.classList?.contains('proof-bars')))) window.staleBarsShown = true;
    }).observe(document, { childList: true, subtree: true });
  });
  const stalePage = await stale.newPage(); await stalePage.goto(article); await ready(stalePage);
  assert.equal(await stalePage.evaluate(() => staleBarsShown), false, 'Mismatched size never paints arrival bars');
  await stale.close();
  console.log('PASS measured proof alignment, stale iframe, stale arrival and browser navigation');

  for (const fallback of ['no-webgl', 'unmeasured', 'reduced']) {
    const ctx = await context({ reducedMotion: fallback === 'reduced' ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(fallback => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('deddeh:reading-mode', 'ink'); localStorage.setItem('deddeh:reading-size', 'largest');
      if (fallback === 'no-webgl') HTMLCanvasElement.prototype.getContext = () => null;
    }, fallback);
    if (fallback === 'unmeasured') await ctx.route('**/writing/the-margin/', route => route.request().frame().parentFrame() ? route.abort() : route.continue());
    const page = await ctx.newPage(); await page.goto(`${base}#writing`);
    await page.locator('.essay-link').first().click(); await page.waitForURL(article); await ready(page);
    await expect(page.locator('html')).toHaveAttribute('data-reading-size', 'largest');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(32, 30, 27)');
    await ctx.close();
  }

  // The head bootstrap sets both preferences even when the article module fails.
  const cold = await context();
  await cold.addInitScript(() => { if (location.protocol !== 'http:') return; localStorage.setItem('deddeh:reading-mode', 'ink'); localStorage.setItem('deddeh:reading-size', 'largest'); });
  await cold.route('**/*.js', route => route.abort());
  const coldPage = await cold.newPage(); await coldPage.goto(article); await ready(coldPage);
  await expect(coldPage.locator('html')).toHaveAttribute('data-reading-size', 'largest');
  await expect(coldPage.locator('.prose')).toHaveCSS('font-size', '27.3px');
  await expect(coldPage.locator('body')).toHaveCSS('background-color', 'rgb(32, 30, 27)');
  await expect(coldPage.locator('.reading-toggle')).toHaveCount(0); await cold.close();

  const denied = await context();
  await denied.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  const deniedPage = await denied.newPage(); await deniedPage.goto(article); await ready(deniedPage);
  await size(deniedPage, 'largest'); await mode(deniedPage, 'ink');
  await deniedPage.locator('.return').click(); await deniedPage.waitForURL(`${base}#writing`); await denied.close();
  const nojs = await context({ javaScriptEnabled: false });
  const plain = await nojs.newPage(); await plain.goto(article); await expect(plain.locator('.prose')).toHaveCSS('font-size', '21px');
  await expect(plain.locator('.reading-preferences')).toHaveCount(0);
  await plain.locator('.return').click(); await plain.waitForURL(`${base}#writing`); await nojs.close();

  const tabs = await context(); const one = await tabs.newPage(), two = await tabs.newPage();
  await one.goto(article); await two.goto(article); await ready(one); await ready(two);
  await size(one, 'largest'); await mode(one, 'ink');
  const fixture = await tabs.request.get(article);
  const secondURL = `${base}writing/second-proof/`;
  const fixtureText = await fixture.text();
  await tabs.route(secondURL, route => route.fulfill({ contentType: 'text/html', body: fixtureText }));
  await two.goto(secondURL); await ready(two);
  await expect(two.locator('html')).toHaveAttribute('data-reading-size', 'largest');
  await expect(two.locator('html')).toHaveAttribute('data-reading-mode', 'ink');
  await one.emulateMedia({ media: 'print' });
  await expect(one.locator('.reading-preferences')).toBeHidden();
  await expect(one.locator('.prose')).toHaveCSS('font-size', '21px');
  await expect(one.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await one.emulateMedia({ media: 'screen' }); await expect(one.locator('.prose')).toHaveCSS('font-size', '27.3px');
  await one.evaluate(() => localStorage.clear());
  await expect(two.locator('html')).toHaveAttribute('data-reading-size', 'original');
  await expect(two.locator('html')).toHaveAttribute('data-reading-mode', 'paper');
  await tabs.close();
  report.checks.push('Measured proof, Back/Forward, no WebGL, unmeasured fallback, reduced motion, failed JS, denied storage, no JS, cross-tab, print');
  assert.deepEqual(errors, [], 'No page errors');
  await writeFile(`${output}/verification.json`, JSON.stringify(report, null, 2) + '\n');
  console.log('PASS fallback, storage, print and no-JavaScript checks');
} finally { await browser.close(); }
