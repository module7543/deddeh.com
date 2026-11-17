// The essay reads without JavaScript. This adds reader preferences and joins it to the index:
// the blocks dissolve into words on arrival, and the paper darkens on the way back.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import './style.css';
import './article.css';
import { initReadingPreferences } from './reading-preferences.js';

const root = document.documentElement;
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Arriving: the index left the sheet's blocks lying where this page's words are. Draw them once more, then let them go.
function arrive() {
  let proof = null;
  try { proof = JSON.parse(sessionStorage.getItem('deddeh:proof')); sessionStorage.removeItem('deddeh:proof'); } catch { /* storage unavailable */ }
  const fresh = proof && (proof.size || 'original') === root.dataset.readingSize && (proof.mode || 'paper') === root.dataset.readingMode && Date.now() - proof.at < 4000 && proof.w === window.innerWidth && proof.h === window.innerHeight && window.scrollY === 0;
  if (fresh && !motion.matches && root.classList.contains('from-proof')) {
    const layer = document.createElement('div');
    layer.className = 'proof-bars';
    layer.setAttribute('aria-hidden', 'true');
    for (const [left, top, width, height, color] of proof.bars) {
      const bar = document.createElement('i');
      bar.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;background:#${color.toString(16).padStart(6, '0')}`;
      layer.append(bar);
    }
    document.body.append(layer);
    layer.getBoundingClientRect(); // paint the bars before they fade
    setTimeout(() => layer.remove(), 900);
  }
  root.classList.add('proofed');
}

// Leaving: links back to the index wait for the paper to darken. Modified clicks and reduced motion go straight there.
let leaving = false;
function leave(event) {
  const link = event.target.closest?.('a[data-leave]');
  if (!link || motion.matches || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (leaving) return;
  leaving = true;
  root.classList.add('is-leaving');
  setTimeout(() => location.assign(link.href), 380);
}

if (window === window.top) { // not when the index is laying this page out to measure it
  initReadingPreferences();
  arrive();
  document.addEventListener('click', leave);
  // The Back button can restore this page as it was left.
  window.addEventListener('pageshow', (event) => { if (event.persisted) { leaving = false; root.classList.remove('is-leaving'); } });
} else root.classList.add('proofed');
