# Sweet on My Tongue — listening room

Built from verified `main` at `0fc710b8b79ef6932b17462dac9149d279c8fd02`, independently of PR #7. The original attachment is copied byte-for-byte to `public/audio/sweet-on-my-tongue.mp3`. Its SHA-256 is recorded in the analysis JSON and verified by a test. No hosting, DNS, contact integration or deployment workflow changes.

## Design

**One plate, read three ways.** A recording's plate is its seven measured bands across its whole length. Music's identity is that one object and the ground it stands on; nothing is drawn that the recording did not measure.

- **The stave.** In Music the floor stops being a grid and is ruled as a stave: long lines along time, one under each band, with a faint bar line every five moments. The same floor shader, lit in violet. The homepage's Music preview is ruled the same way, so the change of ground begins before the page does.
- **The collection** (`projects/music/`). Each recording is a row: number, title in the serif, length, and under it the plate drawn flat as a stamp (64 moments). The sheet raises the plate of the recording that is pointed at or focused, the first by default, and the caption names it. Until a plate has been read (or if its analysis fails) the sheet keeps the piano-roll score. Plates are set in the order they are heard: start to end, low band first.
- **The song.** The title, the relief and the verse share the stave. Two states:
  - *At rest or paused:* the title is the poster, the verse is quiet, and the relief is the resting plate (each block's size and height from the mean energy of its part of the recording). The playhead throws only a faint light.
  - *Playing:* the title steps back to a running head and dims, the verse grows and the current line takes the ink, the relief stands under the playhead to the level of each band and stirs along the rest of its line, and the floor's pool and the playhead's light follow the recording's level and low band. On Pause all of that falls away in under a second.
- **The timeline** is the same plate, flat (80 moments, 40 on phones); what has been heard takes the relief's colours.
- **Between pages** the plate does not dissolve: from the collection to the song and back it crosses the floor to its new place.
- **More recordings.** The song page reads the collection's list and links to the previous and next recording by itself. With one recording there is no such link, and the figure caption stands in its place.
- **Lyrics** are unchanged in behaviour: four lines of the current verse, the orange marker on the current line, no live region, and "Read all lyrics" with every line a seek button.

### How different music changes it

No track has a design of its own. `characterOf()` (`src/listening-data.js`) measures three things from the analysis a recording already has, and they tune the same system:

| Measure | What it is | What it changes |
| --- | --- | --- |
| `motion` | mean change of level from one 50 ms frame to the next | how quickly the relief rises and falls (30–120 ms up, 140–640 ms down): a struck, rhythmic recording is answered sharply, a held one slowly |
| `tilt` | which end of the spectrum the recording spends more time in | the colour of the playhead's light, from orange (low) to teal (high) |
| `sustain` | how full the recording stays | reported for reference; the light already follows the level frame by frame |

The plate itself (stamp, relief, timeline) is different for every recording because it is the recording. Sweet on My Tongue measures `motion` 0.55, `tilt` −0.07, `sustain` 0.43.

**Limit:** the analysis scales every column to the recording's own 98th percentile, so these measures compare a recording with itself, not with other recordings in absolute terms. A quiet track and a loud one with the same shape are lit alike.

The pointer raises nothing on a plate (its geometry belongs to the recording); it still tilts the sheet slightly and lights the floor.

## What the recording drives

- File duration: **206.184 seconds** including MP3 framing; decoded media/PCM duration: **206.160 seconds** (3:26).
- The offline FFT measures seven bands: 40–160, 160–400, 400–900, 900–1800, 1800–3500, 3500–7000 and 7000–12000 Hz. It also measures spectral energy and positive spectral flux (attacks). Frames are 50 ms apart, quantized to bytes; JSON is about 130 kB. The MP3 is 5,075,878 bytes.
- Each block's width, height and resting elevation come from mean band energy during its part of the recording. At the playhead, interpolated current band energy raises the corresponding band; flux adds a small attack accent. Along the rest of its line the band stirs slightly with the same energy. The response is smoothed at rates set by the recording (see How different music changes it) and scaled by presence, which rises on Play and falls on Pause. The timeline is the same seven bands, flat.
- The pulse analysis has a strongest periodicity near **120 BPM**, with half-time/subdivision alternatives. It is diagnostic only: no BPM-driven animation, beat-grid snapping, pitch names or melody-transcription claim.
- The recording has a short opening, first lead lyrics near 16.36 s, a long break after the first refrain (~61–93 s), another break (~140–156 s), and a delayed final vocal tail (~193–196 s). The middle passage remains energetic instrumentally; “no lead lyric” does not mean silence. Separated vocals contain echoes/ad-lib-like residues in some gaps.
- Both the visuals and lyrics read `HTMLAudioElement.currentTime`, including after seeks. There is no secondary clock. Native audio is not routed through an AudioContext. Nothing autoplays.

## Timing method and limits

The supplied 32 lines, punctuation and stanza order are preserved in the page, `sweet-on-my-tongue.txt` and the standalone lyrics JSON. Line starts are **audio-derived**, not evenly spaced.

1. Decode the attachment with FFmpeg; compare a wav2vec2 base-model pass on the full mix.
2. Separate the vocal stem locally with TorchAudio `HDEMUCS_HIGH_MUSDB_PLUS` (10 s windows, 2 s overlap and weighted stitching).
3. Compare base and large (`WAV2VEC2_ASR_LARGE_LV60K_960H`) recognition on the vocal stem. Align the supplied text with a CTC Viterbi path, 20 ms model frames, 20 s inference windows with 2 s context.
4. Inspect disagreement against the separated vocal envelope and recognition timestamps. Re-align six ambiguous phrases within the reviewed bounds in `alignment-windows.json`. This removes the severe error that stretched “I turn you in” to ~89 s. It also corrects early attacks inferred from repeated background syllables around ~52, ~56 and ~180 s.
5. Check all 32 cue intervals against decoded browser media, all three repeated refrains (48.08, 124.84, 172.04 s), long rests, backwards seeks, and the delayed ending. The final phrase intentionally lasts from 183.72 to 196.04 s because its last vocal tail is delayed.

**Limits:** these are approximate line cues, not certified word timings. Strong processing, repeated syllables and vocal/instrument bleed make some phrase endings uncertain. The models generally agree on the clear attacks within a few tenths of a second; that is not a measured accuracy guarantee. Automated recognition is too noisy to establish a definite material deviation from the supplied lyrics, especially individual pronouns. The text has therefore not been silently “corrected.” Human listening review of those words and the sustained/delayed phrase endings remains advisable. Browser playback and visual inspection are verified; no claim is made that an automated transcription is equivalent to an independent human ear audit.

## Add another recording

No new JavaScript animation is needed.

1. Put the original file in `public/audio/<slug>.mp3`.
2. Create an analysis environment with `numpy` and `scipy`, and install FFmpeg. Run:
   ```sh
   python scripts/analyze-audio.py public/audio/<slug>.mp3 public/music/<slug>.analysis.json
   ```
3. Prepare the exact lyrics, with blank lines between stanzas. Create reviewed `{text,start,end,stanza}` cues in `public/music/<slug>.lyrics.json`. For a local automated starting point install CPU `torch` and `torchaudio`, optionally separate vocals, and run:
   ```sh
   python scripts/align-lyrics.py vocals.wav lyrics.txt draft.lyrics.json
   # Optional reviewed phrase constraints:
   python scripts/align-lyrics.py vocals.wav lyrics.txt draft.lyrics.json --windows windows.json
   ```
   The draft explicitly says `reviewRequired`. Review against the actual recording before publishing; remove that flag after review and document limitations. Keep non-lyric gaps. Never accept a forced alignment solely because it produced numbers.
4. Copy `projects/music/sweet-on-my-tongue/index.html` to the new slug. Change title, metadata, track slug, duration, native audio source, analysis/lyric data paths and the complete static lyrics. Keep the static text identical to the cue text; it is the no-JavaScript fallback. Add a row to `.setlist` in `projects/music/index.html`, copied from the existing one: its `href`, number, name, length and `data-analysis` (the path to the analysis JSON from the collection page). The stamp, the raised plate, the character and the previous/next links all follow from that; write no links between songs by hand. Vite discovers the new page automatically.
5. Run the checks below. Never ship model weights, separated stems or Python dependencies to visitors. Only the original audio and compact JSON are public assets.

## Preview and verification

```sh
npm ci
npm run dev
# http://localhost:4173/projects/music/sweet-on-my-tongue/

npm run check
npm test
npm run build:pages
npm run preview -- --port 4174 --base=/deddeh.com/
# http://localhost:4174/deddeh.com/projects/music/sweet-on-my-tongue/

# In another terminal (CHROMIUM_PATH can point to an installed Chromium):
CHROMIUM_PATH=/usr/bin/chromium npm run verify:music
PREVIEW_URL=http://localhost:4174/deddeh.com/ CHROMIUM_PATH=/usr/bin/chromium npm run verify:pages
```

A full native-speed Chromium play-through reached 206.16 s and the End state; captured checkpoints covered the first and repeated refrains, long breaks and the final tail. The shared Chrome window also verified native playback, seeking, pause and full lyrics; it used the WebGL fallback, while a separate Chromium run with software WebGL verified the sculpture. The production-base build contains the original MP3 and both JSON files. Tests cover original-file hashing, feature sampling, geometry dependence on energy, cue boundaries/refrains/gaps, actual decoded playback, pause/resume, keyboard and lyric seeking, navigation, reduced motion, no-JavaScript fallback, loading error/retry, and widths 320–1440 px. The existing homepage, Writing, Apps and mocked Formspree flow are covered by the existing browser verification. No real contact submission is sent.

Reduced motion removes spectral pulsing, the light's response, the title and verse scaling, the glide between pages and lyric transitions, retaining discrete time/line updates. The animation loop stops once the relief has settled after a pause, and on hidden tabs and destruction. The scene remains 141 instances, with no runtime FFT or model inference. Without WebGL the recording, controls and lyrics remain fully usable. Mobile verification uses Chromium viewport/touch emulation; physical iOS/Safari and human timing review remain review limits.

Review images: collection [desktop](../review/music-refined-desktop-collection.jpg) · [mobile](../review/music-refined-mobile-collection.jpg); at rest [desktop](../review/music-refined-desktop-rest.jpg) · [mobile](../review/music-refined-mobile-rest.jpg); playing [desktop](../review/music-refined-desktop-playing.jpg) · [mobile](../review/music-refined-mobile-playing.jpg); paused [desktop](../review/music-refined-desktop-paused.jpg) · [mobile](../review/music-refined-mobile-paused.jpg). Before the refinement: [desktop](../review/sweet-desktop.png) · [mobile](../review/sweet-mobile.png).
