import { initReadingMode } from './reading-mode.js';
import { readReadingSize, resizeReading } from './reading-size.js';

export function initReadingPreferences() {
  const top = document.querySelector('.top');
  if (!top || top.querySelector('.reading-preferences')) return;
  const root = document.documentElement;
  const control = document.createElement('div');
  control.className = 'reading-preferences';
  control.innerHTML = `
    <button class="reading-toggle" type="button" aria-expanded="false" aria-controls="reading-slip">
      <span>Reading</span><span class="reading-summary" aria-hidden="true"></span><span class="reading-chevron" aria-hidden="true">⌄</span>
    </button>
    <section class="reading-slip" id="reading-slip" aria-label="Reading preferences" hidden>
      <div class="reading-appearance"><span class="reading-label">Appearance</span></div>
      <div class="reading-type" role="group" aria-labelledby="reading-size-label">
        <span class="reading-label" id="reading-size-label">Text size</span>
        <div class="size-options">
          <button type="button" data-size="original" aria-pressed="false"><span class="size-specimen" aria-hidden="true">Read</span><span>Original</span></button>
          <button type="button" data-size="larger" aria-pressed="false"><span class="size-specimen" aria-hidden="true">Read</span><span>Larger</span></button>
          <button type="button" data-size="largest" aria-pressed="false"><span class="size-specimen" aria-hidden="true">Read</span><span>Largest</span></button>
        </div>
      </div>
      <p class="reading-caption">A little room for the reader.</p>
    </section>`;
  top.querySelector('.return').before(control);
  const toggle = control.querySelector('.reading-toggle');
  const slip = control.querySelector('.reading-slip');
  const options = [...control.querySelectorAll('[data-size]')];
  const summary = control.querySelector('.reading-summary');
  const sync = () => {
    const size = root.dataset.readingSize || 'original';
    for (const option of options) option.setAttribute('aria-pressed', String(option.dataset.size === size));
    const mode = root.dataset.readingMode === 'ink' ? 'Dark' : 'Light';
    const percent = { original: 100, larger: 115, largest: 130 }[size];
    summary.textContent = `${mode} · ${percent}%`;
    toggle.setAttribute('aria-label', `Reading preferences: ${mode.toLowerCase()}, ${size} text`);
  };
  const close = (returnFocus = false) => {
    slip.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus({ preventScroll: true });
  };
  toggle.addEventListener('click', () => {
    slip.hidden = !slip.hidden;
    toggle.setAttribute('aria-expanded', String(!slip.hidden));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !slip.hidden) { close(true); event.preventDefault(); }
  });
  document.addEventListener('click', event => {
    if (!control.contains(event.target)) close(control.contains(document.activeElement));
  });
  control.addEventListener('focusout', event => {
    if (event.relatedTarget && !control.contains(event.relatedTarget)) close();
  });
  for (const option of options) option.addEventListener('click', () => {
    resizeReading(option.dataset.size);
    try { localStorage.setItem('deddeh:reading-size', option.dataset.size); } catch { /* works for this page */ }
    sync();
  });
  const restore = () => {
    resizeReading(readReadingSize(root.dataset.readingSize));
    sync();
  };
  root.addEventListener('readingchange', sync);
  window.addEventListener('storage', event => {
    if (event.key === 'deddeh:reading-size' || event.key === null) restore();
  });
  window.addEventListener('pageshow', () => { close(control.contains(document.activeElement)); restore(); });
  initReadingMode(control.querySelector('.reading-appearance'));
  restore();
}
