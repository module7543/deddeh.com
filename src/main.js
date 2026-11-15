import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { gsap } from 'gsap';

const SECTIONS = {
  writing: { accent: 'var(--blue)', statement: 'Essays, observations, and notes on markets and long-term decisions.', no: 'Fig. 1', figure: 'The sheet, set as prose with marginalia.' },
  projects: { accent: 'var(--green)', statement: 'Software, research, and other experiments.', no: 'Fig. 2', figure: 'The sheet, set as code.' },
  contact: { accent: 'var(--orange)', statement: 'For correspondence. Details to follow.', no: 'Fig. 3', figure: 'The sheet, set as a postcard.' },
};
const IDLE = { accent: 'var(--orange)', statement: 'A personal site for essays, software, and whatever else holds my attention.', no: 'Fig. 0', figure: 'A ruled sheet. Move across it.' };

const root = document.documentElement;
const toc = document.querySelector('.toc');
const items = [...toc.querySelectorAll('.toc-item')];
const measure = toc.querySelector('.word-measure');
const statement = document.querySelector('.statement');
const figureNo = document.querySelector('.figure-no');
const figureText = document.querySelector('.figure-text');
const marks = [...document.querySelectorAll('.marks span')];
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motion.matches;
let pinned = null, hovered = null, focused = null, active = null;
let field = null, swap = null, shown = IDLE;

// The active word opens along the width axis as far as its line allows.
function fitWidths() {
  const room = Math.min(window.innerWidth - toc.getBoundingClientRect().left * 2, window.innerWidth * (window.innerWidth <= 820 ? 1 : .52));
  for (const item of items) {
    const word = item.querySelector('.word');
    const space = room - (word.getBoundingClientRect().left - toc.getBoundingClientRect().left);
    measure.textContent = word.textContent;
    const width = (wdth) => { measure.style.fontVariationSettings = `'wdth' ${wdth}`; return measure.getBoundingClientRect().width * 1.06; };
    let low = 62, high = 125;
    if (!width(100) || width(high) <= space) { item.dataset.open = high; continue; }
    for (let i = 0; i < 8; i++) { const mid = (low + high) / 2; if (width(mid) > space) high = mid; else low = mid; }
    item.dataset.open = low.toFixed(1);
  }
  for (const item of items) gsap.set(item, { '--w': item === active ? Number(item.dataset.open) : 62 });
}

function show(state) {
  if (state === shown) return;
  shown = state;
  swap?.kill();
  root.style.setProperty('--accent', state.accent);
  const write = () => { statement.textContent = state.statement; figureNo.textContent = state.no; figureText.textContent = state.figure; };
  if (reduced) { write(); gsap.set([statement, figureText], { opacity: 1, y: 0, x: 0 }); return; }
  swap = gsap.timeline()
    .to([statement, figureText], { opacity: 0, duration: .14, ease: 'power1.in' })
    .add(write)
    .fromTo(statement, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out' })
    .fromTo(figureText, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: .5, ease: 'power3.out' }, '<.08');
}

function sync() {
  const next = hovered ?? focused ?? pinned;
  if (next === active) return;
  active = next;
  toc.classList.toggle('has-active', Boolean(active));
  for (const item of items) {
    const on = item === active;
    item.classList.toggle('is-active', on);
    gsap.to(item, { '--w': on ? Number(item.dataset.open ?? 125) : 62, duration: reduced ? 0 : on ? .7 : .45, ease: on ? 'power4.out' : 'power2.inOut', overwrite: true });
  }
  for (const mark of marks) mark.classList.toggle('is-on', mark.dataset.mark === active?.dataset.section);
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
window.addEventListener('resize', fitWidths);
motion.addEventListener('change', (event) => {
  reduced = event.matches;
  swap?.progress(1);
  field?.setReducedMotion(reduced);
});

fitWidths();
restore();
document.fonts?.ready.then(fitWidths);
if (!reduced) {
  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .from('.word-text', { yPercent: 105, duration: .95, stagger: .09 })
    .from('.num', { opacity: 0, duration: .6, stagger: .09 }, .25)
    .from('.lede-bar', { scaleX: 0, transformOrigin: 'left center', duration: .7 }, .2)
    .from('.statement, .figure', { opacity: 0, y: 10, duration: .8 }, .35);
}

// The page is complete without graphics; the floor and sheet are added when WebGL is there.
const stage = document.querySelector('.stage');
import('./field.js').then(({ Field }) => {
  field = new Field(stage, document.querySelector('.sheet-slot'), reduced);
  field.select(active?.dataset.section ?? 'blank');
}).catch(() => stage.classList.add('is-fallback'));
window.addEventListener('pagehide', (event) => { if (!event.persisted) field?.dispose(); });
