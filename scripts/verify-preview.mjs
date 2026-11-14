import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';

const html = await readFile('artifacts/Deddeh-preview.html', 'utf8');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => errors.push(error.message));
const dom = new JSDOM(html, {
  url: 'file:///deddeh-preview/Deddeh-preview.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.matchMedia = () => ({ matches: true, addEventListener() {} });
    window.HTMLCanvasElement.prototype.getContext = () => null;
    window.scrollTo = () => {};
  },
});
await new Promise((resolve) => {
  if (dom.window.document.readyState === 'complete') resolve();
  else dom.window.addEventListener('load', resolve, { once: true });
});
const doc = dom.window.document;
assert.equal(doc.querySelectorAll('.entry-toggle').length, 3);
assert.equal(doc.querySelectorAll('script[src]').length, 0, 'No external scripts');
assert.equal(doc.querySelectorAll('link[href]:not([href^="data:"])').length, 0, 'No external styles or icon');
const styles = doc.querySelector('style').textContent;
assert(!/url\(\s*["']?(?!data:)[^"')]+["']?\)/.test(styles.replaceAll(/url\(data:[^)]+\)/g, '')), 'No external font assets');
for (const name of ['writing', 'projects', 'notes']) {
  const toggle = doc.querySelector(`#${name}-toggle`);
  toggle.click();
  assert.equal(doc.querySelector(`#${name}-panel`).hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(dom.window.location.hash, `#${name}`);
}
assert.equal(doc.querySelector('#writing-panel').hidden, true);
assert.equal(doc.querySelector('#projects-panel').hidden, true);
doc.querySelector('[data-section="notes"] .close-section').click();
assert.equal(doc.querySelector('#notes-panel').hidden, true);
assert.equal(doc.activeElement, doc.querySelector('#notes-toggle'));
assert.deepEqual(errors, [], 'No script errors in the portable bundle');
dom.window.close();
console.log('Portable preview passed: self-contained assets, section toggles, exclusive empty states, focus return, file URL state, and CSS fallback.');
console.log('DOM verification only; this does not establish visual or GPU correctness.');
