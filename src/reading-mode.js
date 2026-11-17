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
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'reading-mode';
  control.setAttribute('aria-label', 'Ink reading mode');
  control.innerHTML = '<span class="mode-paper" aria-hidden="true">Paper</span><span class="mode-divider" aria-hidden="true">/</span><span class="mode-ink" aria-hidden="true">Ink</span>';
  top.querySelector('.return').before(control);
  root.classList.add('reader-enabled');
  let timer;
  const sync = (mode, animate = false) => {
    clearTimeout(timer);
    root.classList.toggle('is-switching-mode', animate);
    applyReadingMode(mode);
    control.setAttribute('aria-pressed', String(mode === 'ink'));
    control.title = mode === 'ink' ? 'Read on Paper' : 'Read in Ink';
    if (animate) timer = setTimeout(() => root.classList.remove('is-switching-mode'), 500);
  };
  control.addEventListener('click', () => {
    const mode = root.dataset.readingMode === 'ink' ? 'paper' : 'ink';
    sync(mode, true);
    try { localStorage.setItem('deddeh:reading-mode', mode); } catch { /* the current page still switches */ }
  });
  const restore = () => sync(readReadingMode(root.dataset.readingMode));
  window.addEventListener('pageshow', restore);
  window.addEventListener('storage', (event) => {
    if (event.key === 'deddeh:reading-mode' || event.key === null) restore();
  });
  restore();
}
