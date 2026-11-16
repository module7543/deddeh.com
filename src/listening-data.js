// Data-only helpers shared by the player and tests. All timing is media time.
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const clock = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
export function cueAt(cues, time) {
  return cues.findIndex((cue) => time >= cue.start && time < cue.end);
}
export function frameAt(data, time) {
  const position = clamp(time / data.step, 0, data.frames.length - 1);
  const index = Math.floor(position), next = Math.min(index + 1, data.frames.length - 1), mix = position - index;
  return data.frames[index].map((v, i) => (v + (data.frames[next][i] - v) * mix) / 255);
}
export function validateAnalysis(data) {
  if (data.version !== 1 || !(data.duration > 0) || !(data.step > 0) || !Array.isArray(data.frames) || !data.frames.length || data.overview?.length !== 20 || [...data.frames, ...data.overview].some(row => row.length !== 9 || row.some(v => !Number.isFinite(v) || v < 0 || v > 255))) throw new Error('Invalid audio analysis');
  return data;
}
export function validateLyrics(data) {
  if (!Array.isArray(data.cues) || !data.cues.length || data.cues.some((c, i) => !c.text || !Number.isInteger(c.stanza) || c.stanza < 0 || !Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start || (i && c.start < data.cues[i - 1].end))) throw new Error('Invalid lyric timing');
  return data;
}
