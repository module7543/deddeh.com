import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.PREVIEW_URL;
// The public preview, or a local build (http://localhost:4173/) when checking a branch before it is merged.
assert(url === 'https://module7543.github.io/deddeh.com/' || /^http:\/\/localhost:\d+\/$/.test(url), 'Verify only the repository preview or a local build');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? 'reduce' : 'no-preference',
    });
    // Formspree is always mocked here: this check must never spend a real submission.
    let outcome = 'fail', posts = 0;
    await context.route('https://formspree.io/**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      posts += 1;
      if (outcome === 'fail') return route.abort('failed');
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ next: '/thanks', ok: true }) });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(error.message));
    // A request cancelled by leaving the page (net::ERR_ABORTED) is not a failed asset; a missing one still shows up below as a 4xx.
    page.on('requestfailed', (request) => request.url().startsWith('https://formspree.io/') || request.failure()?.errorText === 'net::ERR_ABORTED' || failures.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    assert.equal(response.status(), 200);
    assert.equal(page.url(), url, 'The preview must not redirect to a custom domain');
    await page.evaluate(() => document.fonts.ready);
    const writing = page.getByRole('button', { name: /Writing/ });
    const projects = page.getByRole('button', { name: /Projects/ });
    const contact = page.getByRole('button', { name: /Contact/ });
    const figure = page.locator('.figure-no');
    await expect(figure).toHaveText('Fig. 0');
    if (mobile) await writing.tap(); else await writing.click();
    await expect(writing).toHaveAttribute('aria-pressed', 'true');
    await expect(figure).toHaveText('Fig. 1');
    await projects.click();
    await expect(writing).toHaveAttribute('aria-pressed', 'false');
    await expect(figure).toHaveText('Fig. 2');
    // Contact: opens a postcard form; validation, a failed send, a retry, and the confirmation.
    const card = page.locator('#contact-card'), send = page.locator('.send');
    const noOverflow = async (when) => assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `No horizontal overflow ${when}`);
    await contact.focus();
    await contact.press('Enter');
    await expect(card).toBeVisible();
    await expect(page.locator('#cf-name')).toBeFocused();
    if (!mobile) await writing.hover(); // on a phone the index steps aside while the postcard is open
    await expect(page.locator('.statement')).toContainText('A few lines');
    await noOverflow('with the postcard open');
    await send.click();
    await expect(page.locator('#cf-email-error')).toContainText('Add an email');
    await expect(page.locator('#cf-email')).toBeFocused();
    assert.equal(posts, 0, 'An invalid form sends nothing');
    await page.fill('#cf-name', 'Automated check');
    await page.fill('#cf-email', 'check@example.com');
    await page.fill('#cf-message', 'Mocked submission. Nothing is sent to Formspree.');
    await send.click();
    await expect(page.locator('.form-error-text')).toContainText('didn’t go through');
    await expect(page.locator('#cf-message')).toHaveValue('Mocked submission. Nothing is sent to Formspree.');
    await noOverflow('with the error showing');
    outcome = 'ok';
    await send.click();
    await expect(page.locator('.statement')).toHaveText('Posted. Thank you.');
    await expect(card).toBeHidden();
    assert.equal(posts, 2, 'One failed send and one retry');
    await page.getByRole('button', { name: 'Write another' }).click();
    await expect(card).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect(contact).toBeFocused();
    await expect(contact).toHaveAttribute('aria-pressed', 'false');
    await writing.focus();
    await writing.press('ArrowDown');
    await expect(projects).toBeFocused();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'No horizontal overflow');
    if (!mobile) {
      await page.mouse.move(700, 600);
      await contact.hover();
      await expect(contact).toHaveClass(/is-active/);
    }
    // Writing: the index opens under the word, the essay has its own address, and both directions of history work.
    if (!mobile) await page.mouse.move(700, 80);
    await page.evaluate(() => document.activeElement?.blur()); // the arrow-key check above left Projects focused
    if (mobile) await writing.tap(); else await writing.click();
    await expect(writing).toHaveAttribute('aria-expanded', 'true');
    const essay = page.locator('.essay-link').first();
    await expect(essay).toBeVisible();
    await noOverflow('with the Writing index open');
    if (mobile) await essay.tap(); else await essay.click();
    await page.waitForURL(/\/writing\/[a-z0-9-]+\/$/);
    const address = page.url();
    await expect(page.locator('.essay h1')).toBeVisible();
    await expect(page.locator('#essay')).toHaveCSS('opacity', '1');
    await expect(page.locator('.slug')).toContainText('Sample text');
    await noOverflow('on the essay');
    await page.locator('.after').scrollIntoViewIfNeeded();
    await expect(page.locator('.after .toc-item')).toHaveCount(3);
    await page.screenshot({ path: `artifacts/pages-essay-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await page.goBack();
    await expect(page).toHaveURL(/#writing$/);
    await expect(page.locator('#index')).toHaveCSS('opacity', '1'); // not left mid-transition by the history cache
    await expect(page.locator('.essay-link').first()).toBeVisible();
    const direct = await page.goto(address, { waitUntil: 'networkidle' }); // the essay's own address, opened cold
    assert.equal(direct.status(), 200);
    await expect(page.locator('.essay h1')).toBeVisible();
    await page.locator('.return').click();
    await page.waitForURL(/#writing$/);
    await expect(page.getByRole('button', { name: /Writing/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.essay-link').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/pages-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    console.log(`PASS ${mobile ? 'mobile touch/reduced motion' : 'desktop hover/keyboard'}: HTTP 200, assets, pin/unpin, statement and figure, mocked contact flow, Escape, arrow navigation, Writing index, essay and back, no overflow — ${url}`);
    await context.close();
  }
  assert.deepEqual(failures, [], 'No failed assets or JavaScript page errors');
} finally {
  await browser.close();
}
