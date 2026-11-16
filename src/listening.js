import { cueAt, frameAt, clock, clamp, validateAnalysis, validateLyrics, characterOf } from './listening-data.js';
import './listening.css';

const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node; };

// One media clock drives the transport, verse and spectral sheet. No AudioContext,
// oscillators or streaming service: playback stays native, including on iOS.
export function listening(page, { getField, getSheet, motion, getCollection }) {
  const article = page.querySelector('.listen'), slot = page.querySelector('.sheet-slot');
  const audio = page.querySelector('audio'), player = page.querySelector('.player');
  const live = page.querySelector('.live-lyrics'), verse = page.querySelector('.live-verse');
  const status = page.querySelector('.lyric-status'), disclosure = page.querySelector('.full-lyrics');
  const lines = [...page.querySelectorAll('.written-line')];
  const abort = new AbortController();
  let analysis = null, lyrics = null, raf = 0, dead = false, pendingSeek = null;
  let stanza = -1, active = -2, lastTick = -1, lastDraw = 0, installed = false;
  // The relief answers the recording only while it sounds: presence rises on Play and falls away on Pause.
  let presence = 0, heard = null, character = null, lastPaint = 0;
  audio.controls = false;
  const play = el('button', 'play', 'Play'); play.type = 'button'; play.setAttribute('aria-label', `Play ${audio.getAttribute('aria-label')}`);
  play.setAttribute('aria-pressed', 'false');
  const transport = el('div', 'transport'), scrub = el('div', 'scrub');
  const progress = el('span', 'scrub-line'); progress.setAttribute('aria-hidden', 'true');
  const range = el('input', ''); range.type = 'range'; range.min = 0; range.max = article.dataset.length; range.step = .1; range.value = 0;
  range.setAttribute('aria-label', 'Position in the track');
  const time = el('p', 'time'), now = el('span', 'now', '0:00'), total = el('span', 'total', clock(Number(article.dataset.length)));
  time.append(now, ' / ', total); scrub.append(progress, range); transport.append(scrub, time);
  const sound = el('button', 'sound', 'Sound on'); sound.type = 'button'; sound.setAttribute('aria-label', 'Mute audio'); sound.setAttribute('aria-pressed', 'false');
  const error = el('p', 'player-error'); error.setAttribute('role', 'status'); error.hidden = true;
  player.append(play, transport, sound, error);
  const showError = (message) => { error.textContent = message; error.hidden = !message; };
  const duration = () => Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(article.dataset.length);
  const on = (target, type, fn) => target.addEventListener(type, fn, { signal: abort.signal });

  function paintLyrics(time) {
    if (!lyrics) return;
    const index = cueAt(lyrics.cues, time);
    const key = `${index}:${time === 0 ? 'ready' : time >= duration() - .2 ? 'end' : 'run'}`;
    if (key === active) return;
    active = key;
    const next = lyrics.cues.find(c => c.start > time);
    const previous = lyrics.cues.findLast(c => c.end <= time);
    const shortRest = previous && next && next.start - previous.end < 4;
    const cue = index >= 0 ? lyrics.cues[index] : shortRest ? previous : next ?? lyrics.cues.at(-1);
    const group = cue.stanza;
    if (stanza !== group) {
      stanza = group;
      verse.replaceChildren(...lyrics.cues.filter(c => c.stanza === group).map(c => {
        const line = el('p', 'lyric-line', c.text); line.dataset.start = c.start; return line;
      }));
    }
    [...verse.children].forEach(line => {
      const current = index >= 0 && Number(line.dataset.start) === lyrics.cues[index].start;
      line.classList.toggle('is-current', current);
      line.classList.toggle('is-past', Number(line.dataset.start) < time && !current);
    });
    live.classList.toggle('is-instrumental', index < 0 && !shortRest);
    status.textContent = index < 0 && !shortRest ? (time === 0 ? 'Lyrics' : time >= duration() - .2 ? 'End' : 'Instrumental') : `Lyrics · ${String(group + 1).padStart(2, '0')}`;
    // No live region: automatic screen-reader announcements would compete with vocals.
    lines.forEach((line, i) => { if (i === index) line.setAttribute('aria-current', 'true'); else line.removeAttribute('aria-current'); });
  }
  function paint(force = false) {
    if (dead) return;
    const t = audio.currentTime, d = duration(), position = clamp(t / d, 0, 1);
    const reduced = motion.matches;
    // Reduced motion retains discrete seeking/lyric changes, without pulsing relief.
    if (!force && reduced && Math.floor(t) === lastTick) return;
    lastTick = Math.floor(t);
    now.textContent = clock(t); total.textContent = clock(d); range.max = d; range.value = t;
    range.setAttribute('aria-valuetext', `${clock(t)} of ${clock(d)}`);
    scrub.style.setProperty('--position', position);
    paintLyrics(t);
    const field = getField();
    if (analysis && installed) {
      const playing = !audio.paused && !audio.ended, clockNow = performance.now();
      const dt = force || !lastPaint ? 0 : Math.min((clockNow - lastPaint) / 1000, .1);
      lastPaint = clockNow;
      const target = frameAt(analysis, t), toward = (rate) => (dt ? 1 - Math.exp(-dt / rate) : 0);
      // Quick to rise and slower to fall, at rates the recording's own character sets.
      heard = heard && dt ? heard.map((v, i) => v + (target[i] - v) * toward(target[i] > v ? character.rise : character.fall)) : heard ?? target;
      if (reduced) presence = 0;
      else {
        presence += ((playing ? 1 : 0) - presence) * toward(playing ? .3 : .45);
        if (!playing && presence < .004) presence = 0;
      }
      field?.setHead(position);
      field?.setAudioFrame(reduced ? null : heard.map(v => v * presence));
    }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function tick(timestamp) {
    if (timestamp - lastDraw >= 1000 / 30) { paint(); lastDraw = timestamp; }
    if ((sounding() || presence > 0) && !document.hidden && !dead) raf = requestAnimationFrame(tick);
    else raf = 0;
  }
  const sounding = () => !audio.paused && !audio.ended;
  function run() { if (!raf && (sounding() || presence > 0) && !document.hidden) raf = requestAnimationFrame(tick); }
  function state() {
    const playing = !audio.paused && !audio.ended;
    play.textContent = playing ? 'Pause' : audio.ended ? 'Replay' : 'Play';
    play.setAttribute('aria-label', `${playing ? 'Pause' : audio.ended ? 'Replay' : 'Play'} ${audio.getAttribute('aria-label')}`);
    play.setAttribute('aria-pressed', String(playing)); player.classList.toggle('is-playing', playing);
    // The page has two states: at rest the title leads; while the recording sounds, the verse does.
    page.classList.toggle('is-playing', playing);
    page.classList.toggle('is-held', !playing && audio.currentTime > 0 && !audio.ended);
    const label = page.querySelector('.listening-state');
    if (label) label.textContent = playing ? 'Now playing' : audio.ended ? 'Played through' : audio.currentTime > 0 ? 'Paused' : 'Ready when you are';
    paint(true); run();
  }
  on(play, 'click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    showError('');
    if (audio.error) { pendingSeek = audio.currentTime; audio.load(); }
    if (audio.ended) audio.currentTime = 0;
    try { await audio.play(); } catch { if (!dead) showError('Playback could not start. Press Play to try again.'); }
  });
  on(sound, 'click', () => { audio.muted = !audio.muted; });
  on(audio, 'volumechange', () => {
    sound.textContent = audio.muted ? 'Sound off' : 'Sound on';
    sound.setAttribute('aria-label', audio.muted ? 'Unmute audio' : 'Mute audio');
    sound.setAttribute('aria-pressed', String(audio.muted));
  });
  function seek(seconds) {
    pendingSeek = clamp(seconds, 0, duration());
    if (audio.readyState >= 1) { audio.currentTime = pendingSeek; pendingSeek = null; paint(true); }
    else audio.load();
  }
  on(range, 'input', () => seek(Number(range.value)));
  on(audio, 'loadedmetadata', () => { if (pendingSeek !== null) seek(pendingSeek); paint(true); });
  for (const type of ['play', 'pause', 'ended']) on(audio, type, state);
  on(audio, 'timeupdate', () => paint());
  on(audio, 'seeked', () => paint(true));
  on(audio, 'error', () => { audio.pause(); stop(); state(); showError('The recording could not load. Press Play to try again.'); });
  on(audio, 'waiting', () => { player.classList.add('is-loading'); });
  on(audio, 'playing', () => { player.classList.remove('is-loading'); showError(''); });
  on(document, 'visibilitychange', () => { if (document.hidden) stop(); else { paint(true); run(); } });
  on(window, 'pagehide', () => audio.pause());
  on(motion, 'change', () => paint(true));
  on(disclosure, 'toggle', () => { getField()?.resize(); });
  on(page.querySelector('.close-lyrics'), 'click', () => {
    disclosure.open = false; disclosure.querySelector('summary').focus();
    page.querySelector('.listen-head').scrollIntoView({ behavior: 'instant', block: 'start' });
  });

  async function load(path, validate) {
    const response = await fetch(new URL(path, location.href), { signal: abort.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return validate(await response.json());
  }
  load(article.dataset.analysis, validateAnalysis).then(data => {
    analysis = data; character = characterOf(data);
    install(0);
  }).catch(() => {}); // Playback and the text remain usable if the optional visual data fails.
  load(article.dataset.lyrics, validateLyrics).then(data => {
    lyrics = data;
    lines.forEach((line, i) => {
      if (!data.cues[i]) return;
      const button = el('button', 'lyric-seek', line.textContent); button.type = 'button';
      button.setAttribute('aria-label', `${line.textContent}, seek to ${clock(data.cues[i].start)}`);
      on(button, 'click', () => seek(data.cues[i].start));
      line.replaceChildren(button);
    });
    paint(true);
  }).catch(() => { if (!dead) { status.textContent = 'Lyrics'; verse.textContent = 'Read the complete lyrics below.'; } });

  function install(duration) {
    const field = getField(), sheet = getSheet();
    if (!field || !sheet || dead) return;
    if (analysis && !installed) {
      installed = true;
      const name = `recording:${article.dataset.track}`;
      field.define(name, sheet.spectralSheet(analysis), 'music'); field.select(name, duration);
      field.setCharacter(character);
    } else if (!analysis) field.select(field.has(`recording:${article.dataset.track}`) ? `recording:${article.dataset.track}` : 'blank', duration); // already set by the collection
    field.setSlot(slot); paint(true);
  }
  // The songs on either side, read from the collection's own list, so a new recording needs no links written here.
  getCollection?.().then((doc) => {
    if (dead) return;
    const list = [...doc.querySelectorAll('.setlist .entry')], here = list.findIndex(a => a.getAttribute('href').replace(/^\.\/|\/$/g, '') === article.dataset.track);
    const steps = [[here - 1, 'prev', 'Previous'], [here + 1, 'next', 'Next']].filter(([i]) => here >= 0 && list[i]);
    if (!steps.length) return;
    const nav = el('nav', 'tracks'); nav.setAttribute('aria-label', 'More recordings');
    for (const [i, rel, label] of steps) {
      const link = el('a', 'track-step'); link.href = `../${list[i].getAttribute('href').replace(/^\.\//, '')}`; link.rel = rel; link.dataset.room = '';
      link.append(el('span', 'track-step-label', label), el('span', 'track-step-no', list[i].querySelector('.entry-no')?.textContent ?? ''), el('span', 'track-step-title', list[i].querySelector('.entry-name')?.textContent ?? ''));
      link.querySelector('.track-step-no').setAttribute('aria-hidden', 'true');
      nav.append(link);
    }
    article.append(nav);
  }).catch(() => {});
  paint(true);
  return {
    set: install,
    destroy() { dead = true; abort.abort(); stop(); page.classList.remove('is-playing', 'is-held'); audio.pause(); audio.removeAttribute('src'); audio.load(); getField()?.setHead(null); getField()?.setAudioFrame(null); },
  };
}
