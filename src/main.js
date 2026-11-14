import '@fontsource-variable/space-grotesk';
import '@fontsource/archivo-black/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './style.css';
import { gsap } from 'gsap';

const nav = document.querySelector('.index-nav');
const entries = [...nav.querySelectorAll('.entry')];
const toggles = entries.map((entry) => entry.querySelector('.entry-toggle'));
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motion.matches;
let opened = null;
let hovered = null;
let focused = null;
let active = null;
let field = null;
let entrance = null;
document.documentElement.classList.add('enhanced');

function syncSelection() {
  const next = hovered ?? focused ?? opened;
  if (next === active) return;
  active = next;
  entries.forEach((entry) => {
    const selected = entry === active;
    entry.classList.toggle('is-active', selected);
    gsap.to(entry.querySelector('.entry-word'), { x: selected ? 4 : 0, duration: reducedMotion ? 0 : .35, ease: 'power3.out', overwrite: 'auto' });
  });
  field?.select(active);
}

function updateURL(entry) {
  const hash = entry ? `#${entry.dataset.section}` : '#index';
  if (location.hash === hash) return;
  if (location.protocol === 'file:') location.hash = hash;
  else {
    try { history.pushState({}, '', hash); } catch { /* The interface also works with restricted history. */ }
  }
}

function showSection(next, { writeURL = true, focusToggle = false, animate = true } = {}) {
  if (next === opened) return;
  const previous = opened;
  opened = next;
  entries.forEach((entry) => {
    const isOpen = entry === opened;
    const button = entry.querySelector('.entry-toggle');
    const panel = entry.querySelector('.entry-panel');
    button.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen && panel.contains(document.activeElement)) button.focus({ preventScroll: true });
    panel.inert = !isOpen;
    gsap.killTweensOf(panel);
    if (isOpen) {
      panel.hidden = false;
      if (animate && !reducedMotion) gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: .45, ease: 'power3.out' });
      else panel.style.height = '';
    } else if (!panel.hidden) {
      if (animate && !reducedMotion) gsap.to(panel, { height: 0, duration: .28, ease: 'power2.inOut', onComplete() { panel.hidden = true; panel.style.height = ''; } });
      else { panel.hidden = true; panel.style.height = ''; }
    }
  });
  if (writeURL) updateURL(opened);
  if (focusToggle && previous) previous.querySelector('.entry-toggle').focus({ preventScroll: true });
  syncSelection();
}

function restoreLocation() {
  const name = location.hash.slice(1);
  const target = entries.find((entry) => entry.dataset.section === name) ?? null;
  showSection(target, { writeURL: false, animate: false });
}

entries.forEach((entry, index) => {
  const toggle = toggles[index];
  toggle.addEventListener('click', () => showSection(opened === entry ? null : entry));
  entry.querySelector('.close-section').addEventListener('click', () => showSection(null, { focusToggle: true }));
  entry.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = entry;
    syncSelection();
  });
  entry.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = null;
    syncSelection();
    field?.relax();
  });
  toggle.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || reducedMotion) return;
    const bounds = toggle.getBoundingClientRect();
    field?.bend((event.clientX - bounds.left) / bounds.width);
  });
  toggle.addEventListener('keydown', (event) => {
    let target;
    if (event.key === 'ArrowDown') target = (index + 1) % toggles.length;
    if (event.key === 'ArrowUp') target = (index + toggles.length - 1) % toggles.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = toggles.length - 1;
    if (target === undefined) return;
    event.preventDefault();
    toggles[target].focus();
  });
});
nav.addEventListener('focusin', (event) => {
  focused = event.target.closest('.entry');
  syncSelection();
});
nav.addEventListener('focusout', () => {
  queueMicrotask(() => {
    focused = nav.contains(document.activeElement) ? document.activeElement.closest('.entry') : null;
    syncSelection();
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && opened) {
    event.preventDefault();
    showSection(null, { focusToggle: true });
  }
});
for (const anchor of document.querySelectorAll('.identity, .header-index, .footer-index')) {
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    showSection(null);
    document.querySelector('#index').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
  });
}
window.addEventListener('popstate', restoreLocation);
window.addEventListener('hashchange', restoreLocation);
motion.addEventListener('change', (event) => {
  reducedMotion = event.matches;
  entrance?.kill();
  gsap.set('.entry-word', { y: 0, opacity: 1 });
  for (const entry of entries) {
    const panel = entry.querySelector('.entry-panel');
    gsap.killTweensOf(panel);
    panel.hidden = entry !== opened;
    panel.style.height = '';
  }
  field?.setReducedMotion(reducedMotion);
});
restoreLocation();
if (!reducedMotion) {
  entrance = gsap.fromTo('.entry-word', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .08, ease: 'power3.out' });
}

// The index works immediately. Three.js progressively enhances the same highlight.
import('./selection-field.js').then(({ SelectionField }) => {
  field = new SelectionField(nav, reducedMotion);
  field.select(active);
}).catch(() => { /* Keep the CSS highlight if the graphics module cannot load. */ });
window.addEventListener('pagehide', (event) => { if (!event.persisted) field?.dispose(); });
