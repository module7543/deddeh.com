import { cueAt, frameAt, clock, clamp, validateAnalysis, validateLyrics } from './listening-data.js';
import './listening.css';

const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node; };

// One media clock drives the transport, verse and spectral sheet. No AudioContext,
// oscillators or streaming service: playback stays native, including on iOS.
export function listening(page, { getField, getSheet, motion }) {
  const article = page.querySelector('.listen'), slot = page.querySelector('.sheet-slot');
  const audio = page.querySelector('audio'), player = page.querySelector('.player');
  const live = page.querySelector('.live-lyrics'), verse = page.querySelector('.live-verse');
  const status = page.querySelector('.lyric-status'), disclosure = page.querySelector('.full-lyrics');
  const lines = [...page.querySelectorAll('.written-line')];
  const abort = new AbortController();
  let analysis = null, lyrics = null, raf = 0, dead = false, pendingSeek = null;
  let stanza = -1, active = -2, lastTick = -1, lastDraw = 0, pastCell = -1, installed = false;
  audio.controls = false;
  const play = el('button', 'play', 'Play'); play.type = 'button'; play.setAttribute('aria-label', `Play ${audio.getAttribute('aria-label')}`);
  play.setAttribute('aria-pressed', 'false');
  const transport = el('div', 'transport'), scrub = el('div', 'scrub');
  const bars = el('span', 'scrub-bars'); bars.setAttribute('aria-hidden', 'true');
  const cells = Array.from({ length: 80 }, () => bars.appendChild(el('i', '')));
  const range = el('input', ''); range.type = 'range'; range.min = 0; range.max = article.dataset.length; range.step = .1; range.value = 0;
  range.setAttribute('aria-label', 'Position in the track');
  const time = el('p', 'time'), now = el('span', 'now', '0:00'), total = el('span', 'total', clock(Number(article.dataset.length)));
  time.append(now, ' / ', total); scrub.append(bars, range); transport.append(scrub, time);
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
    const past = Math.ceil(position * cells.length);
    if (past !== pastCell) { cells.forEach((cell, i) => cell.classList.toggle('is-past', i < past)); pastCell = past; }
    paintLyrics(t);
    const field = getField();
    if (analysis && installed) {
      field?.setHead(position);
      field?.setAudioFrame(reduced ? null : frameAt(analysis, t));
    }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function tick(timestamp) {
    if (timestamp - lastDraw >= 1000 / 30) { paint(); lastDraw = timestamp; }
    if (!audio.paused && !audio.ended && !document.hidden && !dead) raf = requestAnimationFrame(tick);
    else raf = 0;
  }
  function run() { if (!raf && !audio.paused && !document.hidden) raf = requestAnimationFrame(tick); }
  function state() {
    const playing = !audio.paused && !audio.ended;
    play.textContent = playing ? 'Pause' : audio.ended ? 'Replay' : 'Play';
    play.setAttribute('aria-label', `${playing ? 'Pause' : audio.ended ? 'Replay' : 'Play'} ${audio.getAttribute('aria-label')}`);
    play.setAttribute('aria-pressed', String(playing)); player.classList.toggle('is-playing', playing);
    if (playing) run(); else stop();
    paint(true);
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
    analysis = data;
    cells.forEach((cell, i) => {
      const start = Math.floor(i / cells.length * data.frames.length), end = Math.max(start + 1, Math.floor((i + 1) / cells.length * data.frames.length));
      const level = data.frames.slice(start, end).reduce((sum, f) => sum + f[0], 0) / (end - start) / 255;
      cell.style.height = `${5 + level * 29}px`;
    });
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
    } else if (!analysis) field.select('blank', duration);
    field.setSlot(slot); paint(true);
  }
  paint(true);
  return {
    set: install,
    destroy() { dead = true; abort.abort(); stop(); audio.pause(); audio.removeAttribute('src'); audio.load(); getField()?.setHead(null); getField()?.setAudioFrame(null); },
  };
}
