// The Projects room: the collections (Apps, Music) and the things in them.
// Every page is plain HTML at its own address and opens on its own. This file joins them: links between
// them swap the page's <main> without a reload, so the sheet stays standing and is re-set for each one:
// a window for Apps, laid flat as the frame of a showcase; a score for Music, with the cursor as its playhead.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import './projects.css';
import { gsap } from 'gsap';
import { listening } from './listening.js';
import { validateAnalysis } from './listening-data.js';
import './music.css';

const root = document.documentElement;
const stage = document.querySelector('.stage');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const TONE = { apps: 'var(--green)', music: '#d6ac83' };
const C = { dim: 0x4a463f, line: 0x8f8879, orange: 0xdd7d45, green: 0x86b890 };
let reduced = motion.matches;
let main = document.querySelector('#room');
let field = null, sheet = null, view = null, busy = false, leaving = false;
root.classList.add('js');

const make = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const plain = (event) => !(event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

// ---- A collection: its word open in its block, its entries beneath, the sheet set as the collection.
function shelf(page) {
  const formation = page.dataset.formation, slot = page.querySelector('.sheet-slot');
  const on = page.querySelector('.rooms .toc-item.is-active');
  const others = [...page.querySelectorAll('.rooms .toc-item:not(.is-active)')];
  if (on && !reduced) gsap.fromTo(on, { '--w': 62, '--open': 0 }, { '--w': 112, '--open': 1, duration: .7, ease: 'power4.out' });
  // The other collection's word previews its setting of the sheet, as the index does on the homepage.
  const peek = (name) => { if (field && !busy) field.select(name); };
  for (const other of others) {
    const name = new URL(other.href).pathname.split('/').filter(Boolean).pop();
    other.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') peek(name); });
    other.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') peek(formation); });
  }
  // A recording gets one full-size sculpture. Pointer/focus chooses it; download order cannot.
  // Until its data arrives, the collection's fallback formation remains usable.
  const entries = [...page.querySelectorAll('.entry[data-analysis]')], plates = new Map(), caption = page.querySelector('.figure-text');
  let shown = null, requested = entries[0], dead = false;
  const count = page.querySelector('.recording-count');
  if (count) count.textContent = String(entries.length).padStart(2, '0');
  const nameOf = (entry) => `recording:${entry.getAttribute('href').replace(/^\.\/|\/$/g, '')}`;
  function raise(entry, duration) {
    const data = plates.get(entry), known = field?.has(nameOf(entry)); // known: raised on an earlier visit to this page
    if ((!data && !known) || dead) return;
    shown = entry;
    entries.forEach((other) => other.classList.toggle('is-shown', other === entry));
    if (caption) caption.textContent = entry.querySelector('.entry-name').textContent;
    const number = page.querySelector('.figure-no');
    if (number) number.textContent = entry.querySelector('.entry-no')?.textContent ?? '';
    if (!field || !sheet || busy) return;
    if (!known) field.define(nameOf(entry), sheet.spectralSheet(data), 'music');
    field.setCharacter(null); field.select(nameOf(entry), duration);
  }
  for (const entry of entries) {
    fetch(new URL(entry.dataset.analysis, location.href))
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then((data) => {
        if (dead) return;
        plates.set(entry, validateAnalysis(data));
        if (entry === requested) raise(entry, 1.3);
      }).catch(() => {}); // without its analysis an entry is still a link, and the sheet keeps the score
    const look = () => { requested = entry; if (entry !== shown) raise(entry); };
    entry.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') look(); });
    entry.addEventListener('focus', look);
  }
  const back = () => { if (shown) raise(shown); else peek(formation); };
  for (const other of others) other.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') back(); });
  return {
    set(duration) {
      field.setSlot(slot); field.setHead(null); field.setAudioFrame(null);
      const first = requested ?? shown;
      if (first && (plates.has(first) || field.has(nameOf(first)))) raise(first, duration); else field.select(formation, duration);
    },
    destroy() { dead = true; },
  };
}

// Recorded screens share the existing viewer's chapter selection and page lifecycle.
function recordings(viewer) {
  const videos = [...viewer.querySelectorAll('video')];
  if (!videos.length) return null;
  const controls = viewer.querySelector('.film-controls');
  const play = controls.querySelector('.film-play');
  const themes = [...controls.querySelectorAll('[data-pick]')];
  const visible = new Set();
  const pending = new Map();
  let intent = 'auto';
  viewer.dataset.theme = 'light';
  controls.hidden = false;

  function isPlaying(video) {
    return !video.paused && !video.ended && !video.seeking && video.readyState >= video.HAVE_FUTURE_DATA;
  }
  function syncControl() {
    const playing = videos.some(isPlaying);
    play.textContent = playing ? 'Pause clip' : 'Play clip';
    play.toggleAttribute('data-paused', !playing);
  }
  function update() {
    const active = videos.filter(video => visible.has(video) && video.closest('.shot.is-on') && video.offsetWidth);
    const running = active.find(isPlaying);
    const requested = intent === 'play' || (intent === 'auto' && !motion.matches);
    for (const video of videos) {
      if (!requested || document.hidden || !active.includes(video)) {
        pending.delete(video);
        video.pause();
      } else if (video.paused && !pending.has(video)) {
        if (running && video.readyState > 0) video.currentTime = running.currentTime;
        const attempt = video.play();
        pending.set(video, attempt);
        attempt.then(() => {
          if (pending.get(video) === attempt) pending.delete(video);
          syncControl();
        }, () => {
          // A pause, theme switch or navigation can cancel an older request.
          if (pending.get(video) !== attempt) return;
          intent = 'pause';
          update(); // Stop both prints so the next press retries the pair.
        });
      }
    }
    syncControl();
  }
  for (const video of videos) {
    video.controls = false;
    for (const event of ['playing', 'pause', 'waiting', 'seeking', 'seeked', 'ended', 'emptied', 'error']) {
      video.addEventListener(event, syncControl);
    }
  }
  function preference() {
    if (motion.matches) {
      if (intent === 'play') intent = 'auto';
      for (const video of videos) { pending.delete(video); video.pause(); video.load(); }
    }
    update();
  }
  play.addEventListener('click', () => {
    intent = videos.some(isPlaying) ? 'pause' : 'play';
    update();
  });
  for (const choice of themes) choice.addEventListener('click', () => {
    viewer.dataset.theme = choice.dataset.pick;
    themes.forEach(button => button.setAttribute('aria-pressed', String(button === choice)));
    update();
  });
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio > 0) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    update();
  });
  videos.forEach(video => observer.observe(video));
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', preference);
  return {
    update,
    destroy() {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', preference);
      pending.clear();
      videos.forEach(video => video.pause());
    },
  };
}

// ---- An application: its screens in a frame the blocks draw, one tab a screen.
function app(page) {
  const viewer = page.querySelector('.viewer'), frame = page.querySelector('.frame');
  const shots = [...frame.querySelectorAll('.shot')];
  const tabs = make('div', 'tabs'), caption = make('p', 'caption');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Choose a screen');
  caption.setAttribute('aria-live', 'polite');
  const buttons = shots.map((shot, i) => {
    const tab = make('button', 'tab');
    tab.type = 'button';
    tab.append(make('span', 'tab-no', String(i + 1).padStart(2, '0')), shot.dataset.label ?? `Screen ${i + 1}`);
    tab.addEventListener('click', () => show(i));
    tabs.append(tab);
    return tab;
  });
  if (shots.length > 1) viewer.append(tabs);
  viewer.append(caption);
  const media = recordings(viewer);
  let current = -1;

  // The frame's parts, in CSS pixels from its centre: a title bar, two rails, a foot, and a rule under each tab.
  function bars() {
    const R = frame.getBoundingClientRect();
    if (!R.width) return null;
    const cx = R.left + R.width / 2, cy = R.top + R.height / 2, out = [];
    const bar = (left, top, w, h, c, z = 0) => out.push({ x: left + w / 2 - cx, y: top + h / 2 - cy, w, h, c, z });
    [C.orange, C.dim, C.dim].forEach((c, i) => bar(R.left + i * 13, R.top - 17, 8, 8, c, i ? 0 : .6));
    bar(R.left + 52, R.top - 17, R.width * .32, 8, C.dim); bar(R.left + 56 + R.width * .32, R.top - 17, R.width * .1, 8, C.dim);
    bar(R.right - 44, R.top - 17, 44, 8, C.dim);
    for (let i = 0; i < 4; i++) { bar(R.left - 10, R.top + (R.height * i) / 4 + 2, 4, R.height / 4 - 4, C.dim); bar(R.right + 6, R.top + (R.height * i) / 4 + 2, 4, R.height / 4 - 4, C.dim); }
    for (let i = 0; i < 8; i++) bar(R.left + (R.width * i) / 8 + 2, R.bottom + 7, R.width / 8 - 4, 4, C.dim);
    let cursor = null;
    if (shots.length > 1) buttons.forEach((tab, i) => {
      const t = tab.getBoundingClientRect(), live = i === current;
      bar(t.left, t.bottom - 4, t.width, 4, live ? C.green : C.dim, live ? 1.4 : 0);
      if (live) cursor = { x: t.right + 9 - cx, y: t.bottom - 9 - cy, w: 7, h: 14, c: C.orange, z: 1.2 };
    });
    return { out, cursor };
  }
  function draw(duration) {
    if (!field) return;
    const parts = bars();
    if (parts) field.card(frame, parts.out, parts.cursor, duration);
  }
  function show(i, duration = .5) {
    current = (i + shots.length) % shots.length;
    shots.forEach((shot, n) => shot.classList.toggle('is-on', n === current));
    buttons.forEach((tab, n) => tab.setAttribute('aria-pressed', String(n === current)));
    caption.textContent = shots[current].querySelector('figcaption')?.textContent ?? '';
    media?.update();
    draw(duration);
  }
  tabs.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    show(current + step);
    buttons[current].focus();
  });
  // A swipe across the frame turns to the next screen.
  let from = null;
  frame.addEventListener('pointerdown', (event) => { from = event.clientX; });
  frame.addEventListener('pointerup', (event) => {
    if (from === null) return;
    const dx = event.clientX - from; from = null;
    if (Math.abs(dx) > 44 && shots.length > 1) show(current + (dx < 0 ? 1 : -1));
  });
  frame.addEventListener('pointercancel', () => { from = null; });
  const redraw = () => draw(.3);
  const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
  watch?.observe(frame); watch?.observe(viewer);
  show(0, 0);
  return {
    set(duration) { field.setSlot(frame); field.setHead(null); draw(duration); field.light('apps'); },
    destroy() { watch?.disconnect(); media?.destroy(); },
  };
}

// ---- A track: its score on the sheet, and a player whose position is the sheet's cursor.
// The sound comes from one of three places, named on the page: a file beside it (data-src), Suno's own
// player (data-suno), or neither, in which case a plainly labelled test signal stands in.
const seed = (text) => [...text].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619)) >>> 0, 2166136261) % 9973 + 1;
const SCALE = [0, 2, 4, 7, 9];
function signal(notes, length) {
  // The score itself, played as plain tones: the blocks on the sheet are the notes. Not a recording.
  const rate = 22050, total = Math.ceil(length * rate), samples = new Float32Array(total);
  for (const note of notes) {
    const degree = 13 - note.row, hz = 110 * 2 ** ((12 * Math.floor(degree / 5) + SCALE[degree % 5]) / 12);
    const start = Math.floor(note.at * length * rate), hold = note.for * length, n = Math.floor((hold + .5) * rate), low = note.row > 9;
    for (let i = 0; i < n && start + i < total; i++) {
      const t = i / rate, env = Math.min(t / .015, 1) * Math.exp(-t * (low ? 1.1 : 2.6) / Math.max(hold, .25)) * (t > hold ? Math.max(1 - (t - hold) / .5, 0) : 1);
      samples[start + i] += env * (low ? .2 : .15) * (Math.sin(2 * Math.PI * hz * t) + .3 * Math.sin(4 * Math.PI * hz * t));
    }
  }
  const wav = new DataView(new ArrayBuffer(44 + total * 2));
  const text = (at, s) => [...s].forEach((ch, i) => wav.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); wav.setUint32(4, 36 + total * 2, true); text(8, 'WAVEfmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
  wav.setUint32(24, rate, true); wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); text(36, 'data'); wav.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767 * Math.min(1, (total - i) / (rate * .4)), true);
  return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
}

function track(page) {
  if (page.querySelector('[data-analysis]')) return listening(page, { getField: () => field, getSheet: () => sheet, motion, getCollection: () => fetchPage(new URL('../', location.href).href) });
  const article = page.querySelector('.listen'), slot = page.querySelector('.sheet-slot'), player = page.querySelector('.player');
  const name = `track:${article.dataset.track}`, src = article.dataset.src, suno = article.dataset.suno;
  const title = page.querySelector('h1').textContent;
  let formation = null, audio = null, url = null, ticking = false;
  const head = () => { if (audio?.duration) { paint(); field?.setHead(audio.currentTime / audio.duration); } };
  const stopTick = () => { if (ticking) { gsap.ticker.remove(head); ticking = false; } };
  let paint = () => {};

  if (suno && /^[0-9a-f-]{36}$/i.test(suno)) {
    // Suno's own player, loaded only when asked for. It cannot be styled or followed from here, so the sheet rests.
    const load = make('button', 'play', 'Load player'), holder = make('div', 'suno');
    load.type = 'button';
    const out = make('a', 'source-link', 'Open on Suno');
    out.href = `https://suno.com/song/${suno}`; out.target = '_blank'; out.rel = 'noopener noreferrer';
    load.addEventListener('click', () => {
      const frame = make('iframe');
      frame.src = `https://suno.com/embed/${suno}`; frame.title = `${title}, in Suno’s player`; frame.loading = 'lazy';
      frame.allow = 'encrypted-media'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      holder.replaceChildren(frame);
      load.remove();
    });
    const note = make('p', 'source-note', 'Plays in Suno’s own player, which loads from suno.com when you ask for it. ');
    note.append(out);
    player.append(load, holder, note);
  } else {
    const play = make('button', 'play'), label = make('span', 'play-text', 'Play');
    play.type = 'button'; play.setAttribute('aria-pressed', 'false'); play.append(label);
    const transport = make('div', 'transport'), scrub = make('div', 'scrub'), range = make('input'), ticks = make('span', 'scrub-bars');
    range.type = 'range'; range.min = 0; range.max = 1000; range.value = 0; range.step = 1;
    range.setAttribute('aria-label', 'Position in the track');
    ticks.setAttribute('aria-hidden', 'true');
    const cells = Array.from({ length: 48 }, () => ticks.appendChild(make('i')));
    scrub.append(ticks, range);
    const time = make('p', 'time'), now = make('span', 'now', '0:00'), total = make('span', 'total', clock(Number(article.dataset.length) || 0));
    time.append(now, ' / ', total);
    transport.append(scrub, time);
    player.append(play, transport);
    if (!src) player.append(make('p', 'source-note', 'Test signal. With no recording attached, the player sounds the blocks on the sheet as plain tones, so that it can be tried. It is not music by Sam Deddeh.'));

    paint = () => {
      const p = audio?.duration ? audio.currentTime / audio.duration : 0, at = Math.floor(p * cells.length);
      cells.forEach((cell, i) => { cell.className = i < at ? 'is-past' : i === at && p > 0 ? 'is-now' : ''; });
      now.textContent = clock(audio?.currentTime ?? 0);
      if (document.activeElement !== range || !audio?.paused) range.value = Math.round(p * 1000);
      range.setAttribute('aria-valuetext', `${clock(audio?.currentTime ?? 0)} of ${total.textContent}`);
    };
    const state = (playing) => { label.textContent = playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(playing)); player.classList.toggle('is-playing', playing); };
    function ready() {
      if (audio) return audio;
      audio = new Audio();
      audio.preload = 'metadata';
      audio.src = src ? new URL(src, location.href).href : (url = signal(formation?.notes ?? [], Number(article.dataset.length) || 24));
      audio.addEventListener('loadedmetadata', () => { if (Number.isFinite(audio.duration)) total.textContent = clock(audio.duration); paint(); });
      audio.addEventListener('play', () => { state(true); if (!ticking) { gsap.ticker.add(head); ticking = true; } });
      audio.addEventListener('pause', () => { state(false); stopTick(); head(); });
      audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); field?.setHead(null); });
      audio.addEventListener('error', () => { state(false); if (!player.querySelector('.player-error')) player.append(make('p', 'source-note player-error', 'The recording could not be loaded.')); });
      return audio;
    }
    play.addEventListener('click', () => { const a = ready(); if (a.paused) a.play().catch(() => state(false)); else a.pause(); });
    range.addEventListener('input', () => {
      const a = ready(), to = Number(range.value) / 1000;
      const seek = () => { a.currentTime = to * a.duration; head(); };
      if (a.duration) seek(); else a.addEventListener('loadedmetadata', seek, { once: true });
    });
  }
  return {
    set(duration) {
      formation = sheet.score(seed(article.dataset.track));
      field.define(name, formation, 'music');
      field.setSlot(slot); field.setHead(null); field.select(name, duration);
    },
    score() { formation ??= sheet?.score(seed(article.dataset.track)) ?? null; },
    destroy() { stopTick(); audio?.pause(); audio?.removeAttribute('src'); if (url) URL.revokeObjectURL(url); field?.setHead(null); },
  };
}

// ---- Moving between the room's pages.
const VIEWS = { shelf, app, track };
function mount(duration) {
  root.dataset.tone = main.dataset.tone;
  root.dataset.view = main.dataset.view;
  root.style.setProperty('--accent', TONE[main.dataset.tone] ?? TONE.apps);
  view = VIEWS[main.dataset.view]?.(main) ?? null;
  view?.score?.();
  if (field) view?.set(duration);
}
function enter() {
  if (reduced) { gsap.set(main, { opacity: 1 }); return; }
  gsap.set(main, { opacity: 1 });
  const parts = main.querySelectorAll('.music-heading > *, .recordings, .music-foot, .lede, .show-head > *, .listen-head > *, .live-lyrics, .viewer, .show-body > *, .player, .full-lyrics, .tracks, .rooms li, .figure');
  gsap.from(parts, { opacity: 0, y: 12, duration: .6, stagger: .035, ease: 'power3.out', clearProps: 'opacity,transform' });
}
const pages = new Map();
function fetchPage(url) {
  if (!pages.has(url)) {
    pages.set(url, fetch(url, { headers: { Accept: 'text/html' } })
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.text(); })
      .then((text) => new DOMParser().parseFromString(text, 'text/html'))
      .catch((error) => { pages.delete(url); throw error; }));
  }
  return pages.get(url);
}
async function visit(url, { push = true } = {}) {
  if (busy) { if (!push) location.reload(); return; }
  busy = true;
  try {
    const fade = reduced ? null : gsap.to(main, { opacity: 0, duration: .2, ease: 'power1.in' });
    const [page] = await Promise.all([fetchPage(url), fade]);
    const next = page.querySelector('#room'), back = page.querySelector('.return');
    if (!next || !VIEWS[next.dataset.view]) throw new Error('not a room page');
    view?.destroy();
    if (push) history.pushState({ room: true }, '', url); // before the swap, so the new page's relative links and images resolve
    const fresh = document.importNode(next, true);
    for (const fallback of fresh.querySelectorAll('noscript')) fallback.remove(); // parsed as real elements in a fetched page
    main.replaceWith(fresh);
    main = fresh;
    const here = document.querySelector('.return');
    if (back && here) here.replaceWith(document.importNode(back, true));
    document.title = page.title;
    window.scrollTo(0, 0);
    busy = false;
    mount();
    enter();
    main.focus({ preventScroll: true });
  } catch {
    location.assign(url); // anything unexpected: the page still has its own address
  } finally { busy = false; }
}

document.addEventListener('click', (event) => {
  const link = event.target.closest?.('a[data-room], a[data-leave]');
  if (!link || !plain(event) || link.origin !== location.origin) return;
  if (link.hasAttribute('data-room')) {
    event.preventDefault();
    if (link.href !== location.href) visit(link.href);
    return;
  }
  // Back to the homepage: the page clears first, and the index returns with Projects chosen.
  if (reduced) return;
  event.preventDefault();
  if (leaving) return;
  leaving = true;
  gsap.to(main, { opacity: 0, duration: .24, ease: 'power1.in' });
  setTimeout(() => location.assign(link.href), 260);
});
for (const type of ['pointerover', 'focusin']) {
  document.addEventListener(type, (event) => { const link = event.target.closest?.('a[data-room]'); if (link) fetchPage(link.href).catch(() => {}); });
}
window.addEventListener('popstate', () => visit(location.href, { push: false }));
window.addEventListener('pageshow', (event) => { if (event.persisted) { leaving = false; gsap.set(main, { opacity: 1 }); } });
window.addEventListener('pagehide', (event) => { if (!event.persisted) { view?.destroy(); field?.dispose(); } });
motion.addEventListener('change', (event) => { reduced = event.matches; field?.setReducedMotion(reduced); });

mount();
enter();
// The page is complete without graphics; the floor and sheet are added when WebGL is there.
import('./field.js').then((module) => {
  sheet = module;
  view?.score?.();
  field = new module.Field(stage, main.querySelector('.sheet-slot') ?? main.querySelector('.frame') ?? main, reduced);
  root.classList.add('has-field');
  view?.set(.9);
}).catch(() => stage.classList.add('is-fallback'));
