# Sweet on My Tongue — listening room

The original recording integration was built from verified `main` at `0fc710b8b79ef6932b17462dac9149d279c8fd02`, independently of PR #7. The original attachment is copied byte-for-byte to `public/audio/sweet-on-my-tongue.mp3`. Its SHA-256 is recorded in the analysis JSON and verified by a test. No hosting, DNS, contact integration or deployment workflow changes.

## Art direction V2

Branched from the verified PR #9 head `0c6d16c715bedf2e2c6be5e930925db5e74ff395`, with production `main` at `245167aa620931fac88b8336e0c7d1f2d5185ed4` as a visual reference. This is a selective evolution of that work; no whole JavaScript or CSS file was reverted.

**Sound, given space.** Music has an editorial entrance of its own: a large Instrument Serif title, a brief invitation, an open sculpture, and a numbered catalogue. The composition scales to multiple recordings without featuring a hard-coded song or inventing releases. Apps moves to a quiet cross-link at the foot; Projects remains in the header.

- **Artwork:** `main`'s collection used sparse violet and ivory bars; its song already used the seven-band relief. PR #9 enlarged and repeated that relief across collection, song and timeline. V2 reinterprets the earlier elongated geometry: adjacent moments of similar measured energy join into fragments, and quiet passages leave space. Seven-band analysis, the 141-instance mesh, shadows, and live energy/attack response remain. No piano keys or implied notes are added to the recording artwork.
- **Ground:** the original crossed grid returns at lower contrast in Music. PR #9's level-responsive pool, low-band beam and character-dependent light colour remain independent of the grid.
- **Collection:** each entry is a number, title, duration and invitation to listen. Pointer/focus previews still select that recording's analysis-driven formation. The first recording is selected initially. There are no repeated spectral stamps.
- **Song at rest:** the large title leads and the verse is quiet. The sculpture uses the earlier, smaller `.78` scale. The original player and complete lyrics remain.
- **Song playing:** PR #9's title shrinks and dims, the verse takes prominence, the sculpture responds with smoothed energy and attacks, and the light follows the audio. Mobile now also gives the title a modest `.78` scale change without moving the controls. Pause restores the title and lets the sculpture settle.
- **Timeline:** a restrained amplitude trace restores the original control's clarity. Native range input, keyboard seeking and elapsed time are preserved.
- **Transitions:** PR #9's shared canvas, page entrance choreography, history navigation and sculpture glide are preserved.
- **Future recordings:** previous/next links continue to derive from the collection. One entry alone produces no empty navigation. Geometry and response depend on the recording data, not its name, genre or duration.
- **Lyrics:** the current verse, line marker, instrumental rests, all-lyrics disclosure and lyric seek buttons use the same media clock and unchanged cue data. No live region competes with vocals.

### How different music changes it

No track has a design of its own. `characterOf()` (`src/listening-data.js`) measures three things from the analysis a recording already has, and they tune the same system:

| Measure | What it is | What it changes |
| --- | --- | --- |
| `motion` | mean change of level from one 50 ms frame to the next | how quickly the relief rises and falls (30–120 ms up, 140–640 ms down): a struck, rhythmic recording is answered sharply, a held one slowly |
| `tilt` | which end of the spectrum the recording spends more time in | the colour of the playhead's light, from orange (low) to teal (high) |
| `sustain` | how full the recording stays | reported for reference; the light already follows the level frame by frame |

The fragments and amplitude trace differ with each recording's measured energy. Sweet on My Tongue measures `motion` 0.55, `tilt` −0.07, `sustain` 0.43.

**Limit:** the analysis scales every column to the recording's own 98th percentile, so these measures compare a recording with itself, not with other recordings in absolute terms. A quiet track and a loud one with the same shape are lit alike.

The pointer raises nothing on a recording sculpture (its geometry belongs to the recording); it still tilts the sheet slightly and lights the floor.

## What the recording drives

- File duration: **206.184 seconds** including MP3 framing; decoded media/PCM duration: **206.160 seconds** (3:26).
- The offline FFT measures seven bands: 40–160, 160–400, 400–900, 900–1800, 1800–3500, 3500–7000 and 7000–12000 Hz. It also measures spectral energy and positive spectral flux (attacks). Frames are 50 ms apart, quantized to bytes; JSON is about 130 kB. The MP3 is 5,075,878 bytes.
- Each fragment joins up to four adjacent overview moments within an energy difference of .16. A band-relative threshold of .58 leaves space in quiet passages. Width follows the joined interval; resting elevation follows mean energy; thickness stays constant. At the playhead, interpolated current band energy raises the corresponding band; flux adds a small attack accent. Along the rest of its line the band stirs slightly with the same energy. The response is smoothed at rates set by the recording (see How different music changes it) and scaled by presence, which rises on Play and falls on Pause. The timeline shows mean overall energy in 80 moments (40 visible on phones).
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
4. Copy `projects/music/sweet-on-my-tongue/index.html` to the new slug. Change title, metadata, track slug, duration, native audio source, analysis/lyric data paths and the complete static lyrics. Keep the static text identical to the cue text; it is the no-JavaScript fallback. Add a row to `.setlist` in `projects/music/index.html`, copied from the existing one: its `href`, number, name, length and `data-analysis` (the path to the analysis JSON from the collection page). The sculpture, the character and the previous/next links all follow from that; write no links between songs by hand. Vite discovers the new page automatically.
5. Run the checks below. Never ship model weights, separated stems or Python dependencies to visitors. Only the original audio and compact JSON are public assets.

## Preview and verification

`npm run package:music-preview` produces `artifacts/Deddeh-Music-V2-preview.zip` from the Pages-path build. Unzip and run `python3 preview.py` (Windows: `py preview.py`); the real site opens on a local-only server with bundled audio and fonts. This does not publish anything.

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

V2 review images: collection [desktop](../review/music-v2-desktop-collection.jpg) · [mobile](../review/music-v2-mobile-collection.jpg); at rest [desktop](../review/music-v2-desktop-rest.jpg) · [mobile](../review/music-v2-mobile-rest.jpg); playing [desktop](../review/music-v2-desktop-playing.jpg) · [mobile](../review/music-v2-mobile-playing.jpg); paused [desktop](../review/music-v2-desktop-paused.jpg) · [mobile](../review/music-v2-mobile-paused.jpg).

The V2 review uses headless Chromium with software WebGL and touch emulation. The shared desktop and preview-forwarding tools were not available in this environment. No physical phone, Safari/Firefox, or independent human listening pass is claimed. Audio, lyrics, cue timings, hosting and deployment workflows are unchanged.
