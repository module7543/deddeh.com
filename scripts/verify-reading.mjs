import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://localhost:4175/deddeh.com/';
assert(/^http:\/\/(localhost|127\.0\.0\.1):\d+\/(deddeh\.com\/)?$/.test(base), 'Reading verification uses a local branch build only');
const article = `${base}writing/the-margin/`;
const output = 'docs/review/reading';
await mkdir(output, { recursive: true });
await mkdir('artifacts/reading', { recursive: true });
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), ignoreDefaultArgs: ['--disable-back-forward-cache'] });
const errors = [], report = { contrast: {}, controls: {}, baseline: [], history: [], targets: [] };
const choice = (page, mode) => page.viewportSize().width <= 600
  ? page.locator('.mode-switch')
  : page.getByRole('button', { name: mode === 'paper' ? 'Light' : 'Dark', exact: true });
const ctx = async (options = {}) => {
  const context = await browser.newContext(options);
  await context.route('https://formspree.io/**', route => route.abort());
  return context;
};
const ready = async page => {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#essay')).toHaveCSS('opacity', '1');
};
const settled = async (page, mode) => {
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', mode);
  for (const option of ['paper', 'ink']) await expect(page.locator(`[data-mode="${option}"]`)).toHaveAttribute('aria-pressed', String(mode === option));
  await expect(page.locator('.mode-switch')).toHaveAttribute('aria-label', `Switch to ${mode === 'ink' ? 'light' : 'dark'} reading mode`);
  await expect(page.locator('html')).not.toHaveClass(/is-switching-mode/);
  await expect(page.locator('body')).toHaveCSS('background-color', mode === 'ink' ? 'rgb(32, 30, 27)' : 'rgb(236, 230, 216)');
};
const geometry = page => page.evaluate(() => [...document.querySelectorAll('.essay, .essay-head, .essay h1, .dek, .meta, .prose, .prose > *, .note, .after')].map(node => {
  const r = node.getBoundingClientRect(), s = getComputedStyle(node);
  return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height, font: s.font, spacing: s.letterSpacing };
}));
const capture = async (page, device, mode, position) => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 400);
  await page.screenshot({ path: `${output}/${device}-${mode}-${position}.jpg`, type: 'jpeg', quality: 88, animations: 'disabled' });
};
async function compareBaseline(page, context, device, mode) {
  if (!process.env.BASELINE_URL) return;
  const baseline = await context.newPage();
  await baseline.goto(`${process.env.BASELINE_URL}writing/the-margin/`); await ready(baseline);
  if (await baseline.locator('html').getAttribute('data-reading-mode') !== mode) await baseline.locator('.reading-mode').click();
  await expect(baseline.locator('html')).not.toHaveClass(/is-switching-mode/);
  assert.deepEqual(await geometry(baseline), await geometry(page), `${mode} preserves reference article geometry and type`);
  const viewport = page.viewportSize();
  const header = Math.ceil(await page.locator('.slug').evaluate(n => n.getBoundingClientRect().bottom));
  const clip = { x: 0, y: header, width: viewport.width, height: viewport.height - header };
  assert((await page.screenshot({ clip, animations: 'disabled' })).equals(await baseline.screenshot({ clip, animations: 'disabled' })), `${mode} below the proof label is pixel-identical to the reference build`);
  report.baseline.push(`${device} ${mode}: geometry and pixels below proof label identical to d4235ec7edcff3c781da81001979f805cc792af7`);
  await baseline.close();
}
function luminance(rgb) {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
async function checkContrast(page, mode) {
  const colors = await page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    return ['.identity', '.return', '.reading-mode', '.essay h1', '.essay h1 mark', '.dek', '.meta dt', '.meta dd', '.prose', '.lead', '.prose h2', '.section-no', '.prose a', '.ref', '.note', '.note em', '.slug', '.slug-text', '.pull p', '.figure', '.figure-no'].map(selector => {
      const node = document.querySelector(selector), s = getComputedStyle(node);
      return { selector, text: s.color, bg: selector.endsWith('mark') ? s.backgroundColor : bg };
    });
  });
  const ratios = Object.fromEntries(colors.map(c => [c.selector, +contrast(c.text, c.bg).toFixed(2)]));
  for (const [selector, ratio] of Object.entries(ratios)) assert(ratio >= 4.5, `${mode} ${selector}: ${ratio}:1`);
  report.contrast[mode] = ratios;
  // The frame is deliberately absent: check each visible face and its selected rule.
  const buttons = page.locator('.reading-mode button:visible');
  const controlColors = await buttons.evaluateAll(nodes => nodes.map(node => {
    const bg = getComputedStyle(document.body).backgroundColor;
    const s = getComputedStyle(node.querySelector('.mode-face'));
    return { text: s.color, bg: s.backgroundColor === 'rgba(0, 0, 0, 0)' ? bg : s.backgroundColor, page: bg, rule: s.boxShadow.match(/rgb\([^)]+\)/)?.[0] };
  }));
  for (const segment of controlColors) {
    assert(contrast(segment.text, segment.bg) >= 4.5, `${mode} control label/icon contrast`);
    if (segment.rule) {
      assert(contrast(segment.rule, segment.bg) >= 3, `${mode} selection rule against fill`);
      assert(contrast(segment.rule, segment.page) >= 3, `${mode} selection rule against page`);
    }
  }
  if (controlColors.length === 2) assert.notEqual(controlColors[0].bg, controlColors[1].bg, 'Selected mode has a distinct filled surface');
  const device = page.viewportSize().width <= 600 ? 'mobile' : 'desktop';
  report.controls[`${device}-${mode}`] = {
    labelAndIcon: controlColors.map(s => +contrast(s.text, s.bg).toFixed(2)),
    selectionRule: controlColors.filter(s => s.rule).map(s => ({ fill: +contrast(s.rule, s.bg).toFixed(2), page: +contrast(s.rule, s.page).toFixed(2) })),
    focus: [],
  };
  for (const button of await buttons.all()) {
    await button.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    await expect(button).toBeFocused();
    const focus = await button.evaluate(node => ({ outline: getComputedStyle(node).outlineColor, bg: getComputedStyle(document.body).backgroundColor, style: getComputedStyle(node).outlineStyle }));
    assert.equal(focus.style, 'solid');
    assert(contrast(focus.outline, focus.bg) >= 3);
    report.controls[`${device}-${mode}`].focus.push(+contrast(focus.outline, focus.bg).toFixed(2));
    await button.hover();
    const hover = await button.locator('.mode-face').evaluate(n => ({ text: getComputedStyle(n).color, bg: getComputedStyle(n).backgroundColor }));
    assert(contrast(hover.text, hover.bg) >= 4.5, `${mode} control hover contrast`);
  }
  await page.mouse.move(0, 400);
}
try {
  for (const mobile of [false, true]) {
    const device = mobile ? 'mobile' : 'desktop';
    const context = await ctx({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, colorScheme: 'dark' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(article); await ready(page); await settled(page, 'paper');
    assert.equal(await page.evaluate(() => localStorage.getItem('deddeh:reading-mode')), null, 'OS dark preference must not select Ink');
    const original = await geometry(page);
    const control = choice(page, 'ink');
    const light = choice(page, 'paper');
    const bounds = await control.boundingBox();
    assert(bounds.width >= 44 && bounds.height >= 44, 'Touch target >= 44px');
    await compareBaseline(page, context, device, 'paper');
    await capture(page, device, 'paper', 'opening');
    await checkContrast(page, 'paper');
    if (!mobile) {
      await page.locator('.identity').focus(); await page.keyboard.press('Tab');
      await expect(light).toBeFocused(); await page.keyboard.press('Tab');
      await expect(control).toBeFocused(); await page.keyboard.press('Tab');
      await expect(page.locator('.return')).toBeFocused();
      // Every visible label names an independent, idempotent destination.
      for (const mode of ['paper', 'ink', 'ink', 'paper', 'paper']) {
        const option = choice(page, mode);
        await option.click(); await settled(page, mode); await expect(option).toBeFocused();
        assert.equal(await page.evaluate(() => localStorage.getItem('deddeh:reading-mode')), mode);
        assert.deepEqual(await geometry(page), original);
      }
    }
    await control.press('Space'); await settled(page, 'ink');
    await expect(control).toBeFocused();
    assert.deepEqual(await geometry(page), original, 'Ink changes no typography geometry');
    await compareBaseline(page, context, device, 'ink');
    await capture(page, device, 'ink', 'opening');
    await checkContrast(page, 'ink');
    await page.evaluate(() => scrollTo(0, document.querySelector('#work').getBoundingClientRect().top + scrollY - 130));
    const scroll = await page.evaluate(() => scrollY);
    await capture(page, device, 'ink', 'reading');
    // Use real viewport input here: locator.click() calls scrollIntoView on a sticky
    // element and can move the page itself before the click being tested.
    const at = await light.boundingBox();
    if (mobile) await page.touchscreen.tap(at.x + at.width / 2, at.y + at.height / 2);
    else await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await settled(page, 'paper');
    assert.equal(await page.evaluate(() => scrollY), scroll, 'Switch retains reading position');
    await expect(light).toBeFocused();
    assert.equal((await light.boundingBox()).y >= 0, true, 'Switch remains in the running header');
    await capture(page, device, 'paper', 'reading');
    await page.reload(); await ready(page); await settled(page, 'paper');
    await control.press('Enter'); await settled(page, 'ink');
    if (!mobile) {
      await control.press('Space'); await settled(page, 'ink');
      await light.press('Enter'); await settled(page, 'paper');
      await light.press('Space'); await settled(page, 'paper');
      await control.press('Enter'); await settled(page, 'ink');
    }
    await page.reload(); await ready(page); await settled(page, 'ink');
    // A second article fixture exercises shared assets and persisted preference without publishing invented content.
    const html = await (await context.request.get(article)).text();
    await context.route(`${base}writing/reader-fixture/`, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`${base}writing/reader-fixture/`); await ready(page); await settled(page, 'ink');
    await page.locator('.return').click(); await page.waitForURL(`${base}#writing`);
    await expect(page.locator('html')).not.toHaveAttribute('data-reading-mode');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 19, 17)');
    await page.goBack({ waitUntil: 'commit' }); await ready(page); await settled(page, 'ink');
    await expect(page.locator('html')).not.toHaveClass(/is-leaving/);
    await page.goForward({ waitUntil: 'commit' }); await expect(page.locator('#index')).toHaveCSS('opacity', '1');
    await context.close();
    console.log(`PASS ${device}: default, independent choices/compact action, keyboard/touch, focus/scroll/layout, reload, second article, return/history, screenshots and contrast`);
  }

  // Cold entry must be Ink before the deferred article bundle can load, or even if it fails.
  for (const failure of ['delay', 'abort']) {
    const context = await ctx({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('deddeh:reading-mode', 'ink');
      window.__paintColors = [];
      const sample = () => { if (document.body) window.__paintColors.push(getComputedStyle(document.documentElement).backgroundColor); requestAnimationFrame(sample); };
      requestAnimationFrame(sample);
    });
    await context.route('**/assets/*.js', async route => {
      if (failure === 'abort') return route.abort();
      await new Promise(resolve => setTimeout(resolve, 700)); await route.continue();
    });
    const page = await context.newPage();
    await page.goto(article, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(32, 30, 27)');
    await page.waitForTimeout(150);
    const colors = await page.evaluate(() => window.__paintColors);
    assert(colors.length > 0 && colors.every(c => c === 'rgb(32, 30, 27)'), `No Paper paint during ${failure}ed JS`);
    await context.close();
  }
  console.log('PASS cold Ink: first-frame samples with delayed and failed article bundles');

  // Geometry and stored arrival bars must use the chosen surface even when the iframe was prepared earlier.
  for (const mode of ['paper', 'ink']) {
    const context = await ctx({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(mode => {
      if (!sessionStorage.getItem('test:seeded')) {
        localStorage.setItem('deddeh:reading-mode', mode === 'ink' ? 'paper' : 'ink');
        sessionStorage.setItem('test:seeded', 'yes');
      }
      // Retain the actual payload before article.js consumes it.
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) { if (key === 'deddeh:proof') window.__arrival = JSON.parse(this.getItem(key)); return remove.call(this, key); };
      window.addEventListener('pageshow', e => { window.__persisted = e.persisted; });
    }, mode);
    const page = await context.newPage();
    await page.goto(`${base}#writing`);
    await expect(page.locator('html')).toHaveClass(/has-field/);
    await expect.poll(() => page.evaluate(() => {
      const doc = document.querySelector('.proof-frame')?.contentDocument;
      return doc?.readyState === 'complete' && doc.fonts.status === 'loaded';
    })).toBe(true);
    // Same-document change does not notify the frame: measure() must explicitly resync it.
    await page.evaluate(mode => localStorage.setItem('deddeh:reading-mode', mode), mode);
    await page.locator('.essay-link').first().click();
    await page.waitForURL(article); await ready(page);
    await settled(page, mode);
        const arrival = await page.evaluate(() => window.__arrival);
    assert(arrival?.bars.length > 0, 'Measured proof was used, not the fallback');
    assert.equal(arrival.mode, mode);
    const titleBars = arrival.bars.filter(bar => bar[3] > 40);
    assert(titleBars.length > 0);
    await page.goBack({ waitUntil: 'commit' });
    await expect(page.locator('#index')).toHaveCSS('opacity', '1');
    await expect(page.locator('html')).not.toHaveClass(/is-proofing/);
    report.history.push({ mode, persisted: await page.evaluate(() => window.__persisted) });
    await page.goForward({ waitUntil: 'commit' }); await ready(page);
    await expect(page.locator('html')).not.toHaveClass(/is-leaving/);
    await context.close();
  }
  console.log('PASS measured proof, stale iframe palette, homepage restoration and browser Forward');

  for (const fallback of ['no-webgl', 'unmeasured']) {
    const context = await ctx();
    await context.addInitScript(fallback => {
      localStorage.setItem('deddeh:reading-mode', 'ink');
      if (fallback === 'no-webgl') HTMLCanvasElement.prototype.getContext = () => null;
    }, fallback);
    if (fallback === 'unmeasured') await context.route('**/writing/the-margin/', route => route.request().isNavigationRequest() && route.request().frame().parentFrame() ? route.abort() : route.continue());
    const page = await context.newPage();
    let fallbackPalette;
    await page.exposeFunction('reportFallbackPalette', palette => { fallbackPalette = palette; });
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        if (!document.documentElement?.classList.contains('is-proof-fallback')) return;
        window.reportFallbackPalette(getComputedStyle(document.documentElement).getPropertyValue('--proof-bg').trim());
        observer.disconnect();
      });
      observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.goto(`${base}#writing`);
    // Hold the destination while inspecting the outgoing fallback. Otherwise a fast
    // navigation can destroy its context between the class and palette assertions.
    let releaseNavigation;
    const navigationGate = new Promise(resolve => { releaseNavigation = resolve; });
    await page.route(article, route => route.request().frame().parentFrame() ? route.fallback() : navigationGate.then(() => route.continue()));
    await page.locator('.essay-link').first().click({ noWaitAfter: true });
    // Sample at the class change: a new evaluate() can wait behind the pending
    // navigation even while its destination request is held by this test.
    await expect.poll(() => fallbackPalette).toBe('#201e1b');
    releaseNavigation();
    await page.waitForURL(article); await ready(page); await settled(page, 'ink');
    await context.close();
  }
  console.log('PASS Ink fallback entry without WebGL and without a measured article');

  for (const width of [320, 360, 390, 600, 601, 768, 1100]) {
    const context = await ctx({ viewport: { width, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
    const page = await context.newPage(); await page.goto(article); await ready(page);
    const control = choice(page, 'ink');
    const visible = page.locator('.reading-mode button:visible');
    await expect(visible).toHaveCount(width <= 600 ? 1 : 2);
    const targets = await visible.evaluateAll(nodes => nodes.map(n => ({ name: n.getAttribute('aria-label') || n.textContent, ...n.getBoundingClientRect().toJSON() })));
    for (const bounds of targets) assert(bounds.width >= 44 && bounds.height >= 44, `44px target at ${width}`);
    if (targets.length === 2) assert(targets[0].right <= targets[1].x, 'Mode targets do not overlap');
    report.targets.push({ width, targets });
    await page.locator('.identity').focus(); await page.keyboard.press('Tab');
    await expect(visible.first()).toBeFocused();
    if (width > 600) { await page.keyboard.press('Tab'); await expect(visible.last()).toBeFocused(); }
    await page.keyboard.press('Tab'); await expect(page.locator('.return')).toBeFocused();
    if (width === 320) await capture(page, 'mobile-320', 'paper', 'opening');
    await control.tap();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(32, 30, 27)');
    assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
    const boxes = await page.locator('.top > :not(.marks)').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()));
    for (let i = 1; i < boxes.length; i++) assert(boxes[i].x >= boxes[i - 1].right - 1, `Header clears at ${width}`);
    assert(boxes.every(b => b.x >= 0 && b.right <= width), `Header stays within ${width}px viewport`);
    if (width === 320) await capture(page, 'mobile-320', 'ink', 'opening');
    if (width > 600) { await control.tap(); await settled(page, 'ink'); }
    await choice(page, 'paper').tap(); await settled(page, 'paper');
    if (width > 600) { await choice(page, 'paper').tap(); await settled(page, 'paper'); }
    await page.reload(); await ready(page); await settled(page, 'paper');
    await context.close();
  }
  console.log('PASS reduced motion and narrow/tablet widths 320–1100px');

  const resizing = await ctx({ viewport: { width: 601, height: 844 } });
  const resized = await resizing.newPage(); await resized.goto(article); await ready(resized);
  await choice(resized, 'ink').press('Enter'); await settled(resized, 'ink');
  await resized.setViewportSize({ width: 600, height: 844 });
  await expect(resized.locator('.mode-switch')).toBeFocused();
  await resized.setViewportSize({ width: 601, height: 844 });
  await expect(choice(resized, 'ink')).toBeFocused(); await settled(resized, 'ink');
  await resizing.close();
  console.log('PASS focus retention across the compact breakpoint');

  const storage = await ctx();
  await storage.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  const blocked = await storage.newPage(); await blocked.goto(article); await ready(blocked);
  await choice(blocked, 'ink').click(); await settled(blocked, 'ink');
  await choice(blocked, 'paper').click(); await settled(blocked, 'paper');
  await blocked.locator('.return').click(); await blocked.waitForURL(`${base}#writing`);
  await storage.close();

  const nojs = await ctx({ javaScriptEnabled: false });
  const plain = await nojs.newPage(); await plain.goto(article);
  await expect(plain.locator('.reading-mode')).toHaveCount(0);
  await expect(plain.locator('body')).toHaveCSS('background-color', 'rgb(236, 230, 216)');
  await expect(plain.locator('.prose')).toBeVisible();
  await plain.locator('.return').click(); await plain.waitForURL(`${base}#writing`); await nojs.close();

  const tabs = await ctx();
  const first = await tabs.newPage(), second = await tabs.newPage();
  await first.goto(article); await ready(first);
  await second.goto(article); await ready(second);
  await choice(first, 'ink').click(); await settled(first, 'ink'); await settled(second, 'ink');
  await first.bringToFront();
  assert.match(await first.locator('.reading-mode').ariaSnapshot(), /button "Dark" \[pressed\]/);
  for (const mode of ['ink', 'paper']) {
    if (mode === 'paper') { await choice(first, mode).click(); await settled(first, mode); }
    for (const link of await first.locator('.after .toc-item').all()) {
      await link.hover();
      await first.waitForTimeout(550);
      const colors = await link.evaluate(n => ({ text: getComputedStyle(n.querySelector('.word-text')).color, bg: getComputedStyle(n.querySelector('.word'), '::before').backgroundColor }));
      assert(contrast(colors.text, colors.bg) >= 4.5, `${mode} footer hover contrast: ${JSON.stringify(colors)}`);
    }
    await first.locator('.prose a').first().hover(); await first.waitForTimeout(200);
    const colors = await first.locator('.prose a').first().evaluate(n => ({ text: getComputedStyle(n).color, bg: getComputedStyle(document.body).backgroundColor, selection: getComputedStyle(n, '::selection').color, selectionBg: getComputedStyle(n, '::selection').backgroundColor }));
    assert(contrast(colors.text, colors.bg) >= 4.5, `${mode} link hover contrast`);
    assert(contrast(colors.selection, colors.selectionBg) >= 4.5, `${mode} selection contrast`);
  }
  await settled(second, 'paper'); await tabs.close();
  console.log('PASS live cross-tab preference, accessibility tree, hover and selection contrast');

  const print = await ctx();
  const sheet = await print.newPage(); await sheet.goto(article); await ready(sheet);
  await choice(sheet, 'ink').click(); // print even during the palette transition
  await sheet.emulateMedia({ media: 'print' });
  await expect(sheet.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sheet.locator('.prose')).toHaveCSS('color', 'rgb(27, 25, 22)');
  await expect(sheet.locator('.reading-mode')).toBeHidden();
  await sheet.pdf({ path: 'artifacts/reading/ink-printed-on-paper.pdf', format: 'A4', printBackground: true });
  await sheet.emulateMedia({ media: 'screen' }); await settled(sheet, 'ink');
  await print.close();
  console.log('PASS denied storage, no JavaScript, light print from Ink and return to screen');
  assert.deepEqual(errors, [], 'No article JavaScript errors');
  await writeFile('artifacts/reading/report.json', JSON.stringify(report, null, 2));
} finally { await browser.close(); }
