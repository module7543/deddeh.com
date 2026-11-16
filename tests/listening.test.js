import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { cueAt, frameAt, validateAnalysis, validateLyrics, plateOf, characterOf } from '../src/listening-data.js';
import { spectralSheet } from '../src/field.js';
const analysis = JSON.parse(readFileSync('public/music/sweet-on-my-tongue.analysis.json'));
const lyrics = JSON.parse(readFileSync('public/music/sweet-on-my-tongue.lyrics.json'));

describe('The recording and its timed data', () => {
  it('binds analysis to the exact original MP3 and covers its full duration', () => {
    expect(createHash('sha256').update(readFileSync('public/audio/sweet-on-my-tongue.mp3')).digest('hex')).toBe(analysis.sha256);
    expect(validateAnalysis(analysis)).toBe(analysis);
    expect(analysis.frames.length * analysis.step).toBeGreaterThanOrEqual(analysis.duration);
    expect(analysis.duration).toBeCloseTo(206.16, 2);
  });
  it('preserves all supplied lyrics, in order, with distinct repeated refrains', () => {
    expect(validateLyrics(lyrics)).toBe(lyrics);
    const supplied = readFileSync('docs/music/sweet-on-my-tongue.txt','utf8').split('\n').filter(Boolean);
    expect(lyrics.cues.map(c => c.text)).toEqual(supplied);
    const refrains = lyrics.cues.filter(c => c.text === 'Sweet on my tongue');
    expect(refrains).toHaveLength(3);
    expect(new Set(refrains.map(c => c.start)).size).toBe(3);
    expect(lyrics.cues.at(-1).end).toBeLessThan(analysis.duration);
  });
  it('finds the right line on either side of each boundary, including backward seeks', () => {
    for (const [i, c] of lyrics.cues.entries()) {
      expect(cueAt(lyrics.cues, c.start)).toBe(i);
      expect(cueAt(lyrics.cues, (c.start+c.end)/2)).toBe(i);
      expect(cueAt(lyrics.cues, c.end)).not.toBe(i);
    }
    expect(cueAt(lyrics.cues, 0)).toBe(-1);
    expect(cueAt(lyrics.cues, 80)).toBe(-1);
    expect(cueAt(lyrics.cues, 148)).toBe(-1);
    expect(cueAt(lyrics.cues, 205)).toBe(-1);
    expect(cueAt(lyrics.cues, lyrics.cues[1].start)).toBe(1);
  });
  it('interpolates recording features, clamps seeks and never invents periodic motion', () => {
    const fixture = { step: .5, frames: [[0,255],[255,0]] };
    expect(frameAt(fixture,.25)).toEqual([.5,.5]);
    expect(frameAt(fixture,-100)).toEqual([0,1]);
    expect(frameAt(fixture,100)).toEqual([1,0]);
    expect(frameAt(analysis,48)).not.toEqual(frameAt(analysis,80));
  });
  it('builds geometry from energy; silence changes the relief without changing a track id', () => {
    const silent = {...analysis, overview: analysis.overview.map(row => row.map(() => 0))};
    const a = spectralSheet(analysis), b = spectralSheet(silent);
    expect(a).toHaveLength(141);
    expect(a.spectral).toBe(true);
    expect(a[35].z).toBeGreaterThan(b[35].z);
    expect(new Set(a.slice(0,140).map(block => block.band)).size).toBe(7);
  });
  it('draws the plate from the recording: seven bands a column, the same measurement at any resolution', () => {
    const plate = plateOf(analysis, 64);
    expect(plate).toHaveLength(64);
    expect(plate.every(column => column.length === 7 && column.every(v => v >= 0 && v <= 1))).toBe(true);
    // One column is the whole recording: each band's mean over every frame.
    const mean = analysis.frames.reduce((sum, f) => sum + f[2], 0) / analysis.frames.length / 255;
    expect(plateOf(analysis, 1)[0][0]).toBeCloseTo(mean, 6);
    // The opening is nearly silent, the first refrain is not.
    expect(plate[0].reduce((a, b) => a + b)).toBeLessThan(plate[15].reduce((a, b) => a + b));
    expect(plateOf({ frames: [[0, 0, 255, 0, 0, 0, 0, 0, 0]] }, 3)).toEqual(Array(3).fill([1, 0, 0, 0, 0, 0, 0]));
  });
  it('measures a character from any recording, so different music is lit and answered differently', () => {
    const held = { frames: Array.from({ length: 400 }, (_, i) => [150 + 10 * Math.sin(i / 60), 0, 20, 30, 60, 120, 160, 180, 170]) };
    const struck = { frames: Array.from({ length: 400 }, (_, i) => (i % 10 < 2 ? [240, 200, 250, 200, 100, 80, 60, 40, 30] : [60, 0, 90, 60, 30, 20, 10, 5, 5])) };
    const a = characterOf(held), b = characterOf(struck), song = characterOf(analysis);
    expect(a.motion).toBeLessThan(.1); expect(b.motion).toBeGreaterThan(.6);
    expect(a.tilt).toBeGreaterThan(.3); expect(b.tilt).toBeLessThan(-.3);
    expect(a.fall).toBeGreaterThan(b.fall); expect(a.rise).toBeGreaterThan(b.rise);
    for (const c of [a, b, song]) for (const v of Object.values(c)) expect(Number.isFinite(v)).toBe(true);
    expect(song.motion).toBeGreaterThan(a.motion); expect(song.motion).toBeLessThan(b.motion);
    expect(Math.abs(song.tilt)).toBeLessThan(.3);
    expect(characterOf({ frames: [[0, 0, 0, 0, 0, 0, 0, 0, 0]] }).tilt).toBe(0); // silence divides nothing by zero
  });
  it('lists the recording in the collection with its own analysis, and keeps the song page generic', () => {
    const shelf = readFileSync('projects/music/index.html', 'utf8'), song = readFileSync('projects/music/sweet-on-my-tongue/index.html', 'utf8');
    expect(shelf).toMatch(/href="\.\/sweet-on-my-tongue\/"[^>]*data-analysis="\.\.\/\.\.\/music\/sweet-on-my-tongue\.analysis\.json"/);
    expect(shelf).toContain('class="entry-plate plate"');
    expect(song).not.toMatch(/class="tracks"/); // neighbours are read from the collection, never written by hand
  });
  it('rejects invalid data instead of feeding NaNs into the scene or the media clock', () => {
    expect(() => validateLyrics({ cues: [{text:'x',start:4,end:3}] })).toThrow();
    expect(() => validateAnalysis({...analysis,step:0})).toThrow();
  });
});
