import { gsap } from 'gsap';
import { mountScreen } from './screen.js';

const type = word => [...word].map((_, i) => ({ wait: [115, 89, 145, 102][i % 4], query: word.slice(0, i + 1) }));
const move = (target, wait = 500, note) => ({ target, wait, note });
const tap = (target, wait = 550) => ({ target, click: true, wait });
const where = value => '[data-setting="where"][data-value="' + value + '"]';
const sort = '[data-select="sort"]', detail = '[data-detail="juniper-reel/home-depot"]';
const chapters = [
  { start: {}, end: { query: 'Target' }, steps: [move('input', 170), ...type('Target'), move('.merchant', 600), move('.offer-row', 1150, 'Three offers, one shop')] },
  { start: { query: 'Target', where: 'store' }, end: { query: 'Target', where: 'online' },
    steps: [move('.yield', 260), move(where('online'), 1050), tap(where('online')), move('.alternate', 380, 'Activation adds 5 points')] },
  { start: {}, end: { where: 'online', active: 'ready', sort: 'dollar' },
    steps: [move('.filter-button', 280), tap('.filter-button'), move(where('online')), tap(where('online')),
      move('[data-value="ready"]'), tap('[data-value="ready"]'), move(sort), { wait: 530, select: sort, value: 'dollar' },
      move('[data-back]', 700), tap('[data-back]'), move('.merchant', 460, 'Largest dollar reward first')] },
  { start: { query: 'Home Depot' }, end: { query: 'Home Depot', panel: 'detail', detail: 'juniper-reel/home-depot' },
    steps: [move(detail, 400), tap(detail, 720), move('.detail-lead', 620), move('.fine-print', 1300, 'Check the exclusions')] },
  { start: {}, end: { panel: 'picks', topic: 'Groceries' },
    steps: [move('[data-panel="picks"]', 350), tap('[data-panel="picks"]'), move('[data-topic="Groceries"]', 450),
      tap('[data-topic="Groceries"]', 700), move('.pick-note', 550, 'Category rate · 5%')] },
];

export function mountTour(viewer, frame, show, draw, motion) {
  const app = mountScreen(frame);
  const cursor = document.createElement('i');
  cursor.className = 'tour-pointer';
  cursor.setAttribute('aria-hidden', 'true');
  const annotation = document.createElement('span');
  annotation.className = 'tour-annotation';
  annotation.setAttribute('aria-hidden', 'true');
  frame.append(cursor, annotation);
  const controls = viewer.querySelector('.tour-controls');
  const transport = controls.querySelector('[data-transport]');
  const counter = viewer.querySelector('.chapter-count');
  const lifetime = new AbortController(), opt = { signal: lifetime.signal };
  let chapter = 0, step = 0, timer, flash, deadline = 0, remaining = null, visible = false;
  let mode = motion.matches ? 'rest' : 'playing';
  controls.hidden = false;

  function displayMode() {
    viewer.dataset.playback = mode;
    transport.textContent = mode === 'playing' ? 'Pause tour' : mode === 'manual' || mode === 'finished' ? 'Replay tour' : 'Play tour';
    transport.setAttribute('aria-label', transport.textContent);
  }
  function pulse(target) {
    clearTimeout(flash);
    frame.dataset.signal = target?.closest('.answer, .pick-note') ? 'reward' : 'tap';
    draw(.16);
    flash = setTimeout(() => { delete frame.dataset.signal; draw(.38); }, 530);
  }
  let camera;
  function point(target, note) {
    if (!target) return;
    const { scroller } = app;
    const scrollBounds = scroller.getBoundingClientRect(), before = target.getBoundingClientRect();
    camera?.kill();
    annotation.textContent = note || '';
    function track() {
      const r = target.getBoundingClientRect(), f = frame.getBoundingClientRect();
      const x = Math.min(f.width - 19, r.left - f.left + Math.min(r.width * .62, 90));
      const y = Math.max(0, Math.min(f.height - 23, r.top - f.top + Math.min(r.height * .56, 25)));
      cursor.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      if (note) {
        const left = Math.max(4, Math.min(x + 12, f.width - annotation.offsetWidth - 6));
        const top = y + 52 > f.height ? y - 31 : y + 19;
        annotation.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
      }
    }
    cursor.classList.add('is-visible');
    if (scroller.contains(target) && (before.bottom > scrollBounds.bottom - 9 || before.top < scrollBounds.top + 6)) {
      const offset = (before.top - scrollBounds.top - scroller.clientHeight * .32) / (scrollBounds.height / scroller.offsetHeight);
      camera = gsap.to(scroller, { scrollTop: scroller.scrollTop + offset, duration: motion.matches ? 0 : .48, ease: 'power2.inOut', onUpdate: track });
    }
    track();
  }
  function clearPointer() {
    camera?.kill();
    annotation.textContent = '';
    cursor.classList.remove('is-visible');
  }
  function clearClock() {
    if (timer !== undefined) remaining = Math.max(0, deadline - performance.now());
    clearTimeout(timer); timer = undefined;
  }
  function schedule() {
    clearClock();
    if (mode !== 'playing' || !visible || document.hidden) return;
    const beat = chapters[chapter].steps[step];
    const delay = remaining ?? (beat?.wait ?? 4200);
    remaining = null;
    deadline = performance.now() + delay;
    timer = setTimeout(() => {
      timer = undefined;
      if (!beat) {
        if (chapter + 1 < chapters.length) show(chapter + 1);
        else { mode = 'finished'; displayMode(); clearPointer(); }
        return;
      }
      if (beat.query !== undefined) app.update({ query: beat.query });
      if (beat.select) {
        const select = app.screen.querySelector(beat.select);
        if (select) { select.value = beat.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      if (beat.target) {
        const target = app.screen.querySelector(beat.target);
        point(target, beat.note);
        if (beat.click && target) { pulse(target); target.click(); }
        if (target?.closest('.answer, .pick-note')) pulse(target);
      }
      step++; schedule();
    }, delay);
  }
  function selectChapter(index) {
    clearClock(); remaining = null;
    chapter = index; step = 0;
    if (mode === 'manual' || mode === 'finished') mode = motion.matches ? 'rest' : 'playing';
    counter.textContent = 'Chapter ' + String(index + 1).padStart(2, '0') + ' / 05';
    clearPointer();
    app.reset(chapters[index][mode === 'playing' ? 'start' : 'end']);
    if (mode !== 'playing') step = chapters[index].steps.length;
    displayMode(); schedule();
  }
  transport.addEventListener('click', () => {
    if (mode === 'playing') { clearClock(); camera?.pause(); mode = 'paused'; }
    else {
      const restart = mode !== 'paused' || step === chapters[chapter].steps.length && remaining === null;
      const fromBeginning = mode === 'finished';
      if (!restart) camera?.resume();
      mode = 'playing';
      if (restart) { if (fromBeginning) show(0); else selectChapter(chapter); }
    }
    displayMode(); schedule();
  }, opt);

  function takeOver(e) {
    if (!e.isTrusted || mode === 'manual') return;
    clearClock(); mode = 'manual'; displayMode();
    clearPointer();
  }
  for (const event of ['pointerdown', 'keydown', 'input', 'wheel', 'focusin']) {
    app.screen.addEventListener(event, takeOver, { ...opt, capture: true, passive: true });
  }

  function choose(attribute, value) {
    viewer.dataset[attribute] = value;
    for (const b of controls.querySelectorAll('[data-' + attribute + '-choice]')) {
      b.setAttribute('aria-pressed', String(b.dataset[attribute + 'Choice'] === value));
    }
    clearPointer();
    draw(.35);
  }
  for (const attribute of ['theme', 'width']) {
    controls.querySelectorAll('[data-' + attribute + '-choice]').forEach(b =>
      b.addEventListener('click', () => choose(attribute, b.dataset[attribute + 'Choice']), opt));
  }
  choose('theme', 'light');
  choose('width', window.matchMedia('(max-width: 620px)').matches ? 'phone' : 'desktop');
  // On a narrow host the wide screen keeps its desktop layout, scaled into the rails.
  const fit = new ResizeObserver(() => {
    frame.style.setProperty('--desktop-scale', Math.min(1, frame.clientWidth / 570));
  });
  fit.observe(frame);
  const sight = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: .15 });
  sight.observe(frame);
  document.addEventListener('visibilitychange', schedule, opt);
  motion.addEventListener('change', () => {
    if (motion.matches) { mode = 'rest'; selectChapter(chapter); }
  }, opt);
  return { selectChapter, destroy() { lifetime.abort(); camera?.kill(); clearClock(); clearTimeout(flash); sight.disconnect(); fit.disconnect(); } };
}
