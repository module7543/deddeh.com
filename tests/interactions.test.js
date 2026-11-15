import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

const $ = (selector) => document.querySelector(selector);
const item = (name) => $(`.toc-item[data-section="${name}"]`);
function mouse(element, type) {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  element.dispatchEvent(event);
}

beforeAll(async () => {
  document.documentElement.innerHTML = readFileSync('index.html', 'utf8').replace(/<!doctype html>/i, '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await import('../src/main.js');
});
afterAll(() => vi.restoreAllMocks());
beforeEach(() => {
  for (const name of ['writing', 'projects', 'contact']) mouse(item(name), 'pointerleave');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  document.activeElement?.blur();
  if ($('.reading').getAttribute('aria-pressed') === 'true') $('.reading').click();
  $('#contact-card form').reset();
  vi.unstubAllGlobals();
});

describe('The index, its statement and the figure caption', () => {
  it('starts idle with Writing, Projects and Contact and no invented content', () => {
    expect([...document.querySelectorAll('.toc-item')].map((el) => el.dataset.section)).toEqual(['writing', 'projects', 'contact']);
    expect($('.statement').textContent).toContain('Sam Deddeh');
    expect($('.figure-no').textContent).toBe('Fig. 0');
    expect(document.querySelectorAll('article, time, a[href^="mailto:"]')).toHaveLength(0);
    expect($('#contact-card').hidden).toBe(true);
    expect(document.body.textContent).not.toMatch(/unwritten|nothing published/i);
  });

  it('reads the name as a number and back, only while the sheet is at rest', () => {
    const reading = $('.reading');
    expect(reading.hidden).toBe(false);
    expect(reading.textContent).toBe('Read it as a number');
    reading.click();
    expect(reading.getAttribute('aria-pressed')).toBe('true');
    expect($('.figure-no').textContent).toBe('Fig. 0x');
    expect($('.figure-text').textContent).toContain((0xdedde).toLocaleString('en-US')); // 912,862
    expect($('.figure-text').textContent).toContain((0xdedde).toString(2).replace(/(?=(?:.{4})+$)(?!^)/g, ' '));
    expect($('.statement').textContent).toContain('hexadecimal');
    expect(location.hash).toBe('#0xdedde');
    mouse(item('writing'), 'pointerenter'); // a section outranks either reading
    expect(reading.hidden).toBe(true);
    expect($('.figure-no').textContent).toBe('Fig. 1');
    mouse(item('writing'), 'pointerleave');
    expect($('.figure-no').textContent).toBe('Fig. 0x');
    $('.sheet-slot').click(); // the sheet itself answers too
    expect(reading.getAttribute('aria-pressed')).toBe('false');
    expect($('.figure-no').textContent).toBe('Fig. 0');
    expect($('.statement').textContent).toContain('Sam Deddeh');
    expect(location.hash).toBe('');
  });

  it('leaves the sheet alone while a section is pinned', () => {
    item('projects').click();
    $('.sheet-slot').click();
    expect($('.figure-no').textContent).toMatch(/^Fig\. 2a?$/); // Projects, or the collection the keyboard has landed on
    expect($('.reading').hidden).toBe(true);
    expect(location.hash).toBe('#projects');
  });

  it.each([['writing', 'Fig. 1', 'Essays'], ['projects', 'Fig. 2', 'Software'], ['contact', 'Fig. 3', 'correspondence']])('previews %s on hover and returns to idle', (name, figure, words) => {
    mouse(item(name), 'pointerenter');
    expect(item(name).classList.contains('is-active')).toBe(true);
    expect($('.statement').textContent).toContain(words);
    expect($('.figure-no').textContent).toBe(figure);
    expect($(`[data-mark="${name}"]`).classList.contains('is-on')).toBe(true);
    mouse(item(name), 'pointerleave');
    expect($('.figure-no').textContent).toBe('Fig. 0');
    expect(document.querySelectorAll('.marks .is-on')).toHaveLength(0);
  });

  it('pins one section at a time, records it in the URL, and Escape clears it', async () => {
    item('writing').click();
    expect(item('writing').getAttribute('aria-pressed')).toBe('true');
    expect(location.hash).toBe('#writing');
    item('contact').click();
    expect(item('writing').getAttribute('aria-pressed')).toBe('false');
    expect(item('contact').getAttribute('aria-pressed')).toBe('true');
    expect($('.figure-no').textContent).toBe('Fig. 3');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(item('contact').getAttribute('aria-pressed')).toBe('false');
    expect(location.hash).toBe('');
    expect(document.activeElement).toBe(item('contact')); // focus returns to Contact, which previews it
    item('contact').blur();
    await Promise.resolve();
    expect($('.figure-no').textContent).toBe('Fig. 0');
  });

  it('toggles a pinned section off when chosen again', () => {
    item('projects').click();
    item('projects').click();
    expect(item('projects').getAttribute('aria-pressed')).toBe('false');
  });

  it('lets keyboard activation outrank a resting mouse hover', () => {
    mouse(item('projects'), 'pointerenter');
    item('contact').click(); // detail 0, as a keyboard activation
    expect($('.figure-no').textContent).toBe('Fig. 3');
  });

  it('moves between sections with the arrow keys', () => {
    item('writing').focus();
    item('writing').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(item('projects'));
    item('projects').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(item('contact'));
  });

  it('keeps the page usable when WebGL is unavailable', async () => {
    await vi.waitFor(() => expect($('.stage').classList.contains('is-fallback')).toBe(true));
  });
});

describe('The Writing index', () => {
  const essays = () => $('#essays');
  const link = () => $('.essay-link');

  it('stays closed on hover and opens under Writing once it is chosen', () => {
    expect(essays().hidden).toBe(true);
    mouse(item('writing'), 'pointerenter');
    expect(essays().hidden).toBe(true); // hover previews the section, as before
    expect($('.figure-no').textContent).toBe('Fig. 1');
    mouse(item('writing'), 'pointerleave');
    item('writing').click();
    expect(essays().hidden).toBe(false);
    expect(item('writing').getAttribute('aria-expanded')).toBe('true');
    expect(item('writing').nextElementSibling).toBe(essays()); // next in the tab order
    item('projects').click();
    expect(essays().hidden).toBe(true);
    expect(item('writing').getAttribute('aria-expanded')).toBe('false');
  });

  it('lists every essay as a real link to a page that exists', () => {
    const links = [...document.querySelectorAll('.essay-link')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      const path = a.getAttribute('href');
      expect(path).toMatch(/^\.\/writing\/[a-z0-9-]+\/$/);
      const page = readFileSync(`${path.slice(2)}index.html`, 'utf8');
      expect(page).toContain(`${a.querySelector('.essay-title').textContent}`.replace(/ Is .*/, ''));
      expect(page).toContain('href="../../#writing"');
    }
  });

  it('moves keyboard focus to the first essay, and Escape hands it back to Writing', () => {
    item('writing').focus();
    item('writing').click(); // detail 0, as a keyboard activation
    expect(document.activeElement).toBe(link());
    expect($('.figure-no').textContent).toBe('Fig. 1');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(essays().hidden).toBe(true);
    expect(document.activeElement).toBe(item('writing'));
  });

  it('follows the link directly when motion is reduced, and leaves modified clicks alone', () => {
    item('writing').click();
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    link().addEventListener('click', (event) => event.preventDefault(), { once: true }); // jsdom cannot navigate
    link().dispatchEvent(plain);
    expect(document.documentElement.classList.contains('is-proofing')).toBe(false);
    window.setTestReducedMotion(false);
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    link().dispatchEvent(modified);
    expect(document.documentElement.classList.contains('is-proofing')).toBe(false);
    window.setTestReducedMotion(true);
  });

  it('keeps the sample essay marked as a proof, complete, and without a claimed author', () => {
    const page = new DOMParser().parseFromString(readFileSync('writing/the-margin/index.html', 'utf8'), 'text/html');
    expect(page.querySelector('.slug').textContent).toMatch(/Sample text.*Not an essay by Sam Deddeh/);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelectorAll('.prose h2').length).toBeGreaterThanOrEqual(3);
    expect(page.querySelectorAll('.ref')).toHaveLength(page.querySelectorAll('.note').length);
    expect(page.querySelector('.pull')).not.toBeNull();
    expect(page.querySelector('.identity').getAttribute('href')).toBe('../../');
    const words = page.querySelector('.prose').textContent.trim().split(/\s+/).length;
    expect(words).toBeGreaterThan(800);
    expect(words).toBeLessThan(1300);
  });
});

describe('Projects and its collections', () => {
  const shelf = () => $('#collections');
  const link = (name) => $(`.collection-link[data-collection="${name}"]`);
  const pages = ['projects/apps/index.html', 'projects/music/index.html', 'projects/apps/sample-app/index.html', 'projects/music/sample-track/index.html', 'projects/music/second-sample/index.html'];
  const read = (path) => new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/html');

  it('stays closed on hover and opens under Projects once it is chosen', () => {
    expect(shelf().hidden).toBe(true);
    mouse(item('projects'), 'pointerenter');
    expect(shelf().hidden).toBe(true);
    expect($('.figure-no').textContent).toBe('Fig. 2');
    mouse(item('projects'), 'pointerleave');
    mouse(item('projects'), 'pointerenter');
    item('projects').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(shelf().hidden).toBe(false);
    expect(item('projects').getAttribute('aria-expanded')).toBe('true');
    expect(item('projects').nextElementSibling).toBe(shelf()); // next in the tab order
    expect($('.figure-no').textContent).toBe('Fig. 2');
    expect($('#essays').hidden).toBe(true);
    item('writing').click();
    expect(shelf().hidden).toBe(true);
    expect(item('projects').getAttribute('aria-expanded')).toBe('false');
  });

  it('lists Apps and Music as real links to pages that exist', () => {
    const links = [...document.querySelectorAll('.collection-link')];
    expect(links.map((a) => a.dataset.collection)).toEqual(['apps', 'music']);
    for (const a of links) {
      expect(a.getAttribute('href')).toBe(`./projects/${a.dataset.collection}/`);
      const page = read(`projects/${a.dataset.collection}/index.html`);
      expect(page.querySelector('#room').dataset.view).toBe('shelf');
      expect(page.querySelector('.rooms .is-active .word-text').textContent).toBe(a.querySelector('.essay-title').textContent);
      expect(page.querySelector('.return').getAttribute('href')).toBe('../../#projects');
    }
  });

  it('sets the sheet and the statement as a collection while it is under the pointer or the keyboard', () => {
    item('projects').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    mouse(link('music'), 'pointermove');
    expect($('.figure-no').textContent).toBe('Fig. 2b');
    expect($('.statement').textContent).toContain('Suno');
    mouse(link('music'), 'pointerleave');
    expect($('.figure-no').textContent).toBe('Fig. 2');
    link('apps').focus();
    expect($('.figure-no').textContent).toBe('Fig. 2a');
    expect($('.statement').textContent).toContain('Software');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shelf().hidden).toBe(true);
    expect(document.activeElement).toBe(item('projects'));
  });

  it('follows a collection link directly when motion is reduced, and leaves modified clicks alone', () => {
    item('projects').click();
    link('apps').addEventListener('click', (event) => event.preventDefault(), { once: true }); // jsdom cannot navigate
    link('apps').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.documentElement.classList.contains('is-entering')).toBe(false);
    window.setTestReducedMotion(false);
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    link('apps').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    expect(document.documentElement.classList.contains('is-entering')).toBe(false);
    window.setTestReducedMotion(true);
  });

  it('gives every page of the room its own complete document, and a way back up', () => {
    for (const path of pages) {
      const page = read(path), room = page.querySelector('#room');
      expect(['shelf', 'app', 'track']).toContain(room.dataset.view);
      expect(['apps', 'music']).toContain(room.dataset.tone);
      expect(page.querySelectorAll('h1')).toHaveLength(1);
      expect(page.querySelector('.identity').getAttribute('href')).toMatch(/^(\.\.\/)+$/);
      expect(page.querySelector('.return').getAttribute('href')).toMatch(room.dataset.view === 'shelf' ? /#projects$/ : /^\.\.\/$/);
      for (const a of page.querySelectorAll('#room a[data-room]')) { // links inside the room lead to pages that exist
        const target = new URL(a.getAttribute('href'), `http://x/${path}`).pathname.slice(1);
        expect(() => readFileSync(`${target}index.html`, 'utf8')).not.toThrow();
      }
    }
  });

  it('keeps the samples marked as placeholders, with nothing public implied and no recording attached', () => {
    const app = read('projects/apps/sample-app/index.html');
    expect(app.querySelector('.slug').textContent).toMatch(/Placeholder.*Not a real application/);
    expect(app.querySelector('.access-state').textContent).toBe('Private');
    expect(app.querySelectorAll('.shot img[alt]').length).toBe(app.querySelectorAll('.shot').length);
    expect([...app.querySelectorAll('#room a')].map((a) => a.getAttribute('href'))).toEqual(['../../../#contact']); // no source, live or request link
    expect(app.querySelectorAll('form, .open')).toHaveLength(0);
    for (const slug of ['sample-track', 'second-sample']) {
      const page = read(`projects/music/${slug}/index.html`), listen = page.querySelector('.listen');
      expect(page.querySelector('.slug').textContent).toMatch(/Placeholder track.*Not a recording by Sam Deddeh/);
      expect(listen.dataset.track).toBe(slug);
      expect(listen.hasAttribute('data-src') || listen.hasAttribute('data-suno')).toBe(false);
      expect(page.querySelectorAll('audio, iframe, [autoplay]')).toHaveLength(0);
    }
  });
});

describe('The Contact postcard', () => {
  const card = () => $('#contact-card');
  const form = () => $('#contact-card form');
  const submit = () => form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const fill = (email, message, name = '') => { $('#cf-name').value = name; $('#cf-email').value = email; $('#cf-message').value = message; };
  const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('opens on activation, not on hover, and holds its section while open', () => {
    mouse(item('contact'), 'pointerenter');
    expect(card().hidden).toBe(true);
    mouse(item('contact'), 'pointerleave');
    item('contact').click();
    expect(card().hidden).toBe(false);
    expect(item('contact').getAttribute('aria-expanded')).toBe('true');
    expect($('.statement').textContent).toContain('A few lines');
    mouse(item('writing'), 'pointerenter');
    expect($('.statement').textContent).toContain('A few lines');
    expect(card().hidden).toBe(false);
  });

  it('closes with Escape or Close and returns focus to Contact, keeping what was typed', () => {
    item('contact').click();
    fill('a@b.co', 'Kept.');
    $('.card-close').click();
    expect(card().hidden).toBe(true);
    expect(document.activeElement).toBe(item('contact'));
    expect(item('contact').getAttribute('aria-expanded')).toBe('false');
    item('contact').click();
    expect($('#cf-message').value).toBe('Kept.');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(card().hidden).toBe(true);
  });

  it('validates before sending anything', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    item('contact').click();
    fill('', '');
    submit();
    expect(fetch).not.toHaveBeenCalled();
    expect($('#cf-email-error').textContent).toContain('Add an email');
    expect($('#cf-message-error').textContent).toContain('Write a message');
    expect($('#cf-email').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe($('#cf-email'));
    fill('not-an-email', 'Hello');
    submit();
    expect(fetch).not.toHaveBeenCalled();
    expect($('#cf-email-error').textContent).toContain('incomplete');
    expect($('#cf-message-error').hidden).toBe(true);
  });

  it('sends once to the Formspree form and confirms only after it answers', async () => {
    let answer;
    const fetch = vi.fn(() => new Promise((resolve) => { answer = () => resolve(reply({ next: '/thanks', ok: true })); }));
    vi.stubGlobal('fetch', fetch);
    item('contact').click();
    fill('visitor@example.com', 'Hello there.', 'A. Visitor');
    submit();
    submit(); // an accidental second press
    await settled();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('https://formspree.io/f/moedjgda');
    expect(request.method).toBe('POST');
    expect(request.headers.Accept).toBe('application/json');
    expect(Object.fromEntries(request.body)).toEqual({ name: 'A. Visitor', email: 'visitor@example.com', message: 'Hello there.', _gotcha: '' });
    expect($('.send').getAttribute('aria-disabled')).toBe('true');
    expect($('.statement').textContent).not.toContain('Posted');
    answer();
    await settled(); await settled();
    expect($('.statement').textContent).toBe('Posted. Thank you.');
    expect(card().hidden).toBe(true);
    expect($('.lede-actions').hidden).toBe(false);
    expect($('#cf-message').value).toBe('');
    $('.again').click();
    expect(card().hidden).toBe(false);
    expect($('.lede-actions').hidden).toBe(true);
  });

  it('keeps the message when sending fails and lets the visitor retry', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetch);
    item('contact').click();
    fill('visitor@example.com', 'Do not lose this.');
    submit();
    await settled(); await settled();
    expect($('.form-error-text').textContent).toContain('didn’t go through');
    expect($('.via-formspree').hidden).toBe(false);
    expect($('.send-text').textContent).toBe('Try again');
    expect($('.send').getAttribute('aria-disabled')).toBe('false');
    expect($('#cf-message').value).toBe('Do not lose this.');
    expect($('.statement').textContent).not.toContain('Posted');
    fetch.mockImplementation(() => reply({ next: '/thanks', ok: true }));
    submit();
    await settled(); await settled();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect($('.statement').textContent).toBe('Posted. Thank you.');
    expect($('.form-error-text').textContent).toBe('');
  });

  it('shows a field error that Formspree reports', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ errors: [{ field: 'email', code: 'TYPE_EMAIL', message: 'should be an email' }] }, 422)));
    item('contact').click();
    fill('visitor@example.com', 'Hello');
    submit();
    await settled(); await settled();
    expect($('#cf-email-error').textContent).toBe('should be an email');
    expect(document.activeElement).toBe($('#cf-email'));
    expect(card().hidden).toBe(false);
  });
});
