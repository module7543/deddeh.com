// These two self-contained functions are also inlined by Vite in Writing heads.
// Keep boot independent of the article bundle so a slow/failed module cannot flash Paper.
export function readReadingMode(fallback = 'paper') {
  try { return localStorage.getItem('deddeh:reading-mode') === 'ink' ? 'ink' : 'paper'; }
  catch { return fallback; }
}

export function applyReadingMode(mode) {
  const root = document.documentElement;
  root.dataset.readingMode = mode;
  const surface = getComputedStyle(root).getPropertyValue(`--reading-${mode}`).trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
}

export function initReadingMode() {
  const root = document.documentElement;
  const top = document.querySelector('.top');
  if (!top || top.querySelector('.reading-mode')) return;
  const control = document.createElement('div');
  control.className = 'reading-mode';
  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.5 13.3A8.6 8.6 0 0 1 10.7 3.5a8.6 8.6 0 1 0 9.8 9.8Z"/></svg>';
  control.innerHTML = `
    <div class="mode-options" role="group" aria-label="Reading appearance">
      <button type="button" class="mode-paper" data-mode="paper" aria-pressed="false"><span class="mode-face">${sun}<span>Light</span></span></button>
      <button type="button" class="mode-ink" data-mode="ink" aria-pressed="false"><span class="mode-face">${moon}<span>Dark</span></span></button>
    </div>
    <button type="button" class="mode-switch"><span class="mode-face"><span class="mode-to-paper">${sun}</span><span class="mode-to-ink">${moon}</span></span></button>`;
  const options = [...control.querySelectorAll('[data-mode]')];
  const compact = control.querySelector('.mode-switch');
  top.querySelector('.return').before(control);
  root.classList.add('reader-enabled');
  let timer;
  const sync = (mode, animate = false) => {
    clearTimeout(timer);
    root.classList.toggle('is-switching-mode', animate);
    applyReadingMode(mode);
    for (const option of options) option.setAttribute('aria-pressed', String(option.dataset.mode === mode));
    compact.title = mode === 'ink' ? 'Switch to light reading mode' : 'Switch to dark reading mode';
    compact.setAttribute('aria-label', compact.title);
    if (animate) timer = setTimeout(() => root.classList.remove('is-switching-mode'), 500);
  };
  const select = mode => {
    // An explicit choice is remembered even when it matches the default, without
    // restarting the fade or disturbing the focused button.
    if (mode !== root.dataset.readingMode) sync(mode, true);
    try { localStorage.setItem('deddeh:reading-mode', mode); } catch { /* the current page still switches */ }
  };
  for (const option of options) option.addEventListener('click', () => select(option.dataset.mode));
  compact.addEventListener('click', () => select(root.dataset.readingMode === 'ink' ? 'paper' : 'ink'));
  // Preserve keyboard focus if a viewport change hides the currently focused control.
  const narrow = window.matchMedia('(max-width: 600px)');
  narrow.addEventListener('change', () => {
    if (!control.contains(document.activeElement)) return;
    const target = narrow.matches ? compact : options.find(option => option.dataset.mode === root.dataset.readingMode);
    target.focus({ preventScroll: true });
  });
  const restore = () => sync(readReadingMode(root.dataset.readingMode));
  window.addEventListener('pageshow', restore);
  window.addEventListener('storage', (event) => {
    if (event.key === 'deddeh:reading-mode' || event.key === null) restore();
  });
  restore();
}
