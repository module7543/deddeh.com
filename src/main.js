import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { gsap } from 'gsap';
import { createContact } from './contact.js';
import { createProof } from './proof.js';

const SECTIONS = {
  writing: { accent: 'var(--blue)', statement: 'Essays, observations, and notes on markets and long-term decisions.', no: 'Fig. 1', figure: 'The sheet, set as prose with marginalia.' },
  projects: { accent: 'var(--green)', statement: 'Software, research, and other experiments.', no: 'Fig. 2', figure: 'The sheet, set as code.' },
  contact: { accent: 'var(--orange)', statement: 'For correspondence. Select Contact to write a few lines.', no: 'Fig. 3', figure: 'The sheet, set as a postcard.' },
};
const WRITING_CARD = { accent: 'var(--orange)', statement: 'A few lines, and they come straight to me.', no: 'Fig. 3', figure: 'The postcard, laid flat to write on.' };
let posted = null; // set once Formspree has acknowledged a message
// At rest the sheet carries the name, and the name reads two ways: as a word, and as the number it spells in hexadecimal.
const NAME = { accent: 'var(--orange)', statement: 'I’m Sam Deddeh. Essays, software, and whatever else holds my attention.', no: 'Fig. 0', figure: 'The sheet, set as a name.', formation: 'name', flip: 'Read it as a number' };
const NUMBER = { accent: 'var(--orange)', statement: 'Deddeh is also a number: DEDDE in hexadecimal, with the h that assembly uses to mark one.', no: 'Fig. 0x', figure: '912,862. One block a bit: 1101 1110 1101 1101 1110.', formation: 'bits', flip: 'Read it as a name' };
const NUMBER_HASH = '#0xdedde';
let IDLE = NAME;

const root = document.documentElement;
const toc = document.querySelector('.toc');
const items = [...toc.querySelectorAll('.toc-item')];
const measure = toc.querySelector('.word-measure');
const statement = document.querySelector('.statement');
const figureNo = document.querySelector('.figure-no');
const figureText = document.querySelector('.figure-text');
const marks = [...document.querySelectorAll('.marks span')];
const index = document.querySelector('#index');
const slot = document.querySelector('.sheet-slot');
const again = document.querySelector('.lede-actions');
const reading = document.querySelector('.reading');
const contactItem = items.find((item) => item.dataset.section === 'contact');
const writingItem = items.find((item) => item.dataset.section === 'writing');
const essays = document.querySelector('.essays');
const essayLinks = [...essays.querySelectorAll('.essay-link')];
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const phone = window.matchMedia('(max-width: 820px)');
let reduced = motion.matches;
let pinned = null, hovered = null, focused = null, active = null;
let field = null, swap = null, shown = IDLE;
const rest = () => active?.dataset.section ?? IDLE.formation;

// The active word opens along the width axis as far as its line allows.
function fitWidths() {
  // Measured from the laid-out page, not window.innerWidth, which a phone can report before its viewport settles.
  const narrow = phone.matches, page = document.documentElement.clientWidth, left = toc.getBoundingClientRect().left;
  // With the postcard open, the active word stops short of it.
  const room = narrow ? toc.clientWidth : contact?.isOpen ? slot.getBoundingClientRect().left - left - 24 : Math.min(page - left * 2, page * .52);
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
  for (const item of items) gsap.to(item, { '--w': item === active ? Number(item.dataset.open) : 62, duration: reduced ? 0 : .5, ease: 'power3.out', overwrite: true });
}

function show(state) {
  if (state === shown) return;
  shown = state;
  swap?.kill();
  root.style.setProperty('--accent', state.accent);
  const write = () => { statement.textContent = state.statement; figureNo.textContent = state.no; figureText.textContent = state.figure; if (state.flip) reading.textContent = state.flip; };
  if (reduced) { write(); gsap.set([statement, figureText], { opacity: 1, y: 0, x: 0 }); return; }
  swap = gsap.timeline()
    .to([statement, figureText], { opacity: 0, duration: .14, ease: 'power1.in' })
    .add(write)
    .fromTo(statement, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out' })
    .fromTo(figureText, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: .5, ease: 'power3.out' }, '<.08');
}

function sync() {
  // While the postcard is open nothing but a deliberate choice changes the section.
  const open = Boolean(contact?.isOpen);
  const next = open ? pinned : hovered ?? focused ?? pinned;
  const state = !next ? IDLE : next === contactItem && open ? WRITING_CARD : next === contactItem && posted ? posted : SECTIONS[next.dataset.section];
  again.hidden = state !== posted;
  reading.hidden = state !== IDLE;
  reading.setAttribute('aria-pressed', String(IDLE === NUMBER));
  index.classList.toggle('is-idle', state === IDLE);
  index.classList.toggle('is-listing', pinned === writingItem && next === writingItem);
  if (next === active) { show(state); if (!open) field?.select(rest()); return; }
  active = next;
  toc.classList.toggle('has-active', Boolean(active));
  for (const item of items) {
    const on = item === active;
    item.classList.toggle('is-active', on);
    gsap.to(item, { '--w': on ? Number(item.dataset.open ?? 125) : 62, duration: reduced ? 0 : on ? .7 : .45, ease: on ? 'power4.out' : 'power2.inOut', overwrite: true });
  }
  for (const mark of marks) mark.classList.toggle('is-on', mark.dataset.mark === active?.dataset.section);
  show(state);
  if (!open) field?.select(rest());
}

// The second reading of the name. Offered only while the sheet is at rest.
function read(number, { writeURL = true } = {}) {
  IDLE = number ? NUMBER : NAME;
  if (writeURL && !pinned) {
    try { history.replaceState(null, '', number ? NUMBER_HASH : location.pathname + location.search); } catch { /* restricted history */ }
  }
  sync();
}

function setForm(open, options) {
  if (open === contact.isOpen) return;
  if (open) posted = null;
  index.classList.toggle('form-open', open);
  contactItem.setAttribute('aria-expanded', String(open));
  if (open) contact.open(options); else contact.close();
  fitWidths();
}

// Pinning Writing opens the index beneath it: the essays. Hover only previews the section, as before.
let listed = false, unfold = null;
function listEssays(open, { keyboard = false, focus = true } = {}) {
  if (open !== listed) {
    listed = open;
    writingItem.setAttribute('aria-expanded', String(open));
    unfold?.kill();
    if (reduced) { essays.hidden = !open; gsap.set(essays, { clearProps: 'height,opacity' }); }
    else if (open) {
      essays.hidden = false;
      unfold = gsap.fromTo(essays, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .55, ease: 'power3.out', onComplete: () => gsap.set(essays, { clearProps: 'height' }) });
    } else unfold = gsap.to(essays, { height: 0, opacity: 0, duration: .3, ease: 'power2.inOut', onComplete: () => { essays.hidden = true; } });
    if (open) proof.prepare(essayLinks[0]);
  }
  if (open && keyboard && focus) essayLinks[0]?.focus({ preventScroll: true });
}

// Opening an essay pulls a proof of it: the blocks lie flat exactly where the page's words will be,
// the sheet under them turns to paper and grows to fill the window, and the page takes over from there.
let leaving = false;
function openEssay(event, link) {
  if (reduced || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (leaving) return;
  leaving = true;
  root.classList.add('is-proofing');
  const bars = field ? proof.measure(link) : null;
  const go = () => {
    try { if (bars) sessionStorage.setItem('deddeh:proof', JSON.stringify({ at: Date.now(), w: window.innerWidth, h: window.innerHeight, bars: bars.page })); } catch { /* storage unavailable */ }
    location.assign(link.href);
  };
  if (bars) field.proof(proof.frame, bars.field, go); else setTimeout(go, 360);
}
essayLinks.forEach((link) => {
  link.addEventListener('click', (event) => openEssay(event, link));
  for (const type of ['pointerenter', 'pointerdown', 'focus']) link.addEventListener(type, () => proof.prepare(link));
});
// The browser's Back button can restore this page as it was left, mid-proof.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !leaving) return;
  leaving = false;
  root.classList.remove('is-proofing');
  field?.unproof();
  field?.select(rest());
});

// Pinning Contact opens the postcard; pinning anything else, or nothing, closes it.
function pin(item, { writeURL = true, keyboard = false, focus = true } = {}) {
  pinned = item;
  if (item !== contactItem) posted = null;
  for (const other of items) other.setAttribute('aria-pressed', String(other === pinned));
  setForm(item === contactItem && !posted, { keyboard, focus });
  listEssays(item === writingItem, { keyboard, focus });
  if (writeURL) {
    try { history.replaceState(null, '', pinned ? `#${pinned.dataset.section}` : location.pathname + location.search); } catch { /* restricted history */ }
  }
  sync();
}
function restore() {
  if (location.hash.toLowerCase() === NUMBER_HASH) IDLE = NUMBER;
  pin(items.find((item) => item.dataset.section === location.hash.slice(1)) ?? null, { writeURL: false, focus: false });
}

items.forEach((item, index) => {
  item.addEventListener('click', (event) => {
    if (event.detail === 0) hovered = null; // keyboard activation outranks a resting mouse
    if (pinned === item) { hovered = null; pin(null); } else pin(item, { keyboard: event.detail === 0 });
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
function leaveContact() {
  hovered = null;
  pin(null);
  contactItem.focus({ preventScroll: true });
}
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !pinned) return;
  if (contact.isOpen) leaveContact();
  else {
    const inIndex = essays.contains(document.activeElement);
    hovered = null;
    pin(null);
    if (inIndex) writingItem.focus({ preventScroll: true });
  }
});
reading.addEventListener('click', () => read(IDLE === NAME));
// The sheet itself answers a click or tap the same way; the button above is the keyboard's route.
// With Writing chosen, the sheet is set as prose, and a click on it opens the newest essay.
slot.addEventListener('click', () => {
  if (!active && !contact.isOpen) read(IDLE === NAME);
  else if (pinned === writingItem && active === writingItem) essayLinks[0]?.click();
});
again.querySelector('.again').addEventListener('click', () => { posted = null; pin(contactItem, { keyboard: true }); });
window.addEventListener('hashchange', restore);
window.addEventListener('resize', fitWidths);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitWidths).observe(toc);
motion.addEventListener('change', (event) => {
  reduced = event.matches;
  swap?.progress(1);
  field?.setReducedMotion(reduced);
});

const proof = createProof({ isReduced: () => reduced, hasField: () => Boolean(field) });
const contact = createContact({
  card: document.querySelector('#contact-card'),
  isReduced: () => reduced,
  getField: () => field,
  onCloseRequest: leaveContact,
  onPosted: () => {
    const day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    posted = { accent: 'var(--orange)', statement: 'Posted. Thank you.', no: 'Fig. 3', figure: `The postcard, on its way. ${day}.` };
    setForm(false);
    sync();
    contactItem.focus({ preventScroll: true });
    if (!reduced) gsap.fromTo('.lede-bar', { scaleX: 1 }, { scaleX: 3.2, transformOrigin: 'left center', duration: .35, ease: 'power3.out', yoyo: true, repeat: 1 });
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  },
});

fitWidths();
restore();
swap?.progress(1); // opened on a section's address: its statement is set before the page's entrance, not swapped in during it
document.fonts?.ready.then(fitWidths);
// The display face can finish loading after `ready` has resolved; measure again whenever a face arrives.
document.fonts?.addEventListener?.('loadingdone', fitWidths);
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
  field = new Field(stage, slot, reduced);
  document.documentElement.classList.add('has-field');
  if (listed) proof.prepare(essayLinks[0]);
  // The sheet opens ruled and empty, as it always has, and is then signed.
  if (contact.isOpen) contact.draw(); else field.select(rest(), active ? 1.15 : 2.1, active || reduced ? 0 : .7);
}).catch(() => stage.classList.add('is-fallback'));
window.addEventListener('pagehide', (event) => { if (!event.persisted) field?.dispose(); });
