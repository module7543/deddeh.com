import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { gsap } from 'gsap';

const SECTIONS = {
  writing: { word: 'Writing', caption: '(nothing yet under)', accent: 'var(--blue)', detail: 'Writing: essays and observations. Nothing published yet.' },
  projects: { word: 'Projects', caption: '(nothing yet under)', accent: 'var(--green)', detail: 'Projects: software and experiments. Nothing published yet.' },
  notes: { word: 'Notes', caption: '(nothing yet under)', accent: 'var(--orange)', detail: 'Notes: links and marginalia. Nothing published yet.' },
};
const IDLE = { word: 'Unwritten', caption: '(mostly)', accent: 'var(--ink)', detail: 'Move across the page, or choose a section.' };

const root = document.documentElement;
const toc = document.querySelector('.toc');
const items = [...toc.querySelectorAll('.toc-item')];
const readout = document.querySelector('.readout');
const wordBox = readout.querySelector('.readout-word');
const wordText = readout.querySelector('.readout-text');
const wipe = readout.querySelector('.readout-wipe');
const measure = readout.querySelector('.readout-measure');
const caption = readout.querySelector('.readout-caption');
const detail = document.querySelector('.detail');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motion.matches;
let pinned = null, hovered = null, focused = null, active = null;
let field = null, swap = null, shown = IDLE, baseSize = 120;

// Every readout word fills the same measure: the width axis does the fitting.
function fit(word) {
  const target = readout.clientWidth;
  measure.textContent = word;
  measure.style.fontSize = `${baseSize}px`;
  const width = (wdth) => { measure.style.fontVariationSettings = `'wdth' ${wdth}`; return measure.getBoundingClientRect().width; };
  if (!target || !width(100)) return { wdth: 62, size: baseSize };
  let low = 62, high = 125;
  if (width(low) >= target) return { wdth: low, size: baseSize * (target / width(low)) };
  if (width(high) <= target) return { wdth: high, size: baseSize };
  for (let i = 0; i < 9; i++) { const mid = (low + high) / 2; if (width(mid) > target) high = mid; else low = mid; }
  return { wdth: low, size: baseSize };
}
function setWord(state) {
  const { wdth, size } = fit(state.word);
  wordText.textContent = state.word;
  wordBox.style.fontSize = `${size}px`;
  wordBox.style.fontVariationSettings = `'wdth' ${wdth.toFixed(1)}`;
  caption.textContent = state.caption;
}
function layout() {
  baseSize = Math.min(readout.clientWidth / 4.15, window.innerHeight * .3);
  setWord(shown);
}

function show(state) {
  if (state === shown) return;
  shown = state;
  detail.textContent = state.detail;
  swap?.kill();
  if (reduced) { root.style.setProperty('--accent', state.accent); setWord(state); gsap.set(wipe, { scaleX: 0 }); return; }
  swap = gsap.timeline()
    .set(wipe, { transformOrigin: 'left center' })
    .to(wipe, { scaleX: 1, duration: .22, ease: 'power3.in' })
    .add(() => { root.style.setProperty('--accent', state.accent); setWord(state); })
    .set(wipe, { transformOrigin: 'right center' })
    .to(wipe, { scaleX: 0, duration: .5, ease: 'power4.out' })
    .fromTo(caption, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .4, ease: 'power2.out' }, '<');
}

function sync() {
  const next = hovered ?? focused ?? pinned;
  if (next === active) return;
  active = next;
  toc.classList.toggle('has-active', Boolean(active));
  for (const item of items) {
    const on = item === active;
    item.classList.toggle('is-active', on);
    gsap.to(item, { '--w': on ? 125 : 62, duration: reduced ? 0 : on ? .6 : .4, ease: on ? 'power4.out' : 'power2.inOut', overwrite: 'auto' });
  }
  show(active ? SECTIONS[active.dataset.section] : IDLE);
  field?.select(active?.dataset.section ?? 'blank');
}

function pin(item, { writeURL = true } = {}) {
  pinned = item;
  for (const other of items) other.setAttribute('aria-pressed', String(other === pinned));
  if (writeURL) {
    try { history.replaceState(null, '', pinned ? `#${pinned.dataset.section}` : location.pathname + location.search); } catch { /* restricted history */ }
  }
  sync();
}
function restore() {
  pin(items.find((item) => item.dataset.section === location.hash.slice(1)) ?? null, { writeURL: false });
}

items.forEach((item, index) => {
  item.addEventListener('click', (event) => {
    if (event.detail === 0) hovered = null; // keyboard activation outranks a resting mouse
    if (pinned === item) { hovered = null; pin(null); } else pin(item);
  });
  item.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hovered = item; sync(); } });
  item.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') { hovered = null; sync(); } });
  item.addEventListener('keydown', (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : step ? (index + step + items.length) % items.length : null;
    if (target === null) return;
    event.preventDefault();
    items[target].focus();
  });
});
toc.addEventListener('focusin', (event) => {
  const item = event.target.closest('.toc-item');
  let keyboard = true;
  try { keyboard = item?.matches(':focus-visible') ?? false; } catch { /* older engines: treat focus as keyboard focus */ }
  focused = keyboard ? item : null;
  if (focused) hovered = null; // the keyboard takes over from a resting mouse
  sync();
});
toc.addEventListener('focusout', () => { focused = null; queueMicrotask(sync); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && pinned) { hovered = null; pin(null); } });
window.addEventListener('hashchange', restore);
window.addEventListener('resize', layout);
motion.addEventListener('change', (event) => {
  reduced = event.matches;
  swap?.progress(1);
  field?.setReducedMotion(reduced);
});

layout();
restore();
document.fonts?.ready.then(layout);
if (!reduced) {
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.toc-item', { y: 18, opacity: 0, duration: .7, stagger: .07 })
    .fromTo(wipe, { scaleX: 1, transformOrigin: 'right center' }, { scaleX: 0, duration: .9, ease: 'power4.inOut' }, .1)
    .from('.readout-caption, .colophon', { opacity: 0, duration: .8 }, .5);
}

// The page is complete without graphics; the block field is added when WebGL is there.
const stage = document.querySelector('.stage');
import('./field.js').then(({ Field }) => {
  field = new Field(stage, document.querySelector('.sheet-slot'), reduced);
  field.select(active?.dataset.section ?? 'blank');
}).catch(() => stage.classList.add('is-fallback'));
window.addEventListener('pagehide', (event) => { if (!event.persisted) field?.dispose(); });
