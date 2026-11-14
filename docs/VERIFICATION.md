# Revision verification — 14 November 2026

## Automated and source checks

- `npm run check`: JavaScript syntax passes.
- `npm test`: 13 JSDOM interaction tests pass. They cover all three honest empty states, exclusive expansion, arrow/Home/End navigation, Escape and close-button focus return, coherent hover selection, section history restoration, invalid links, live reduced-motion changes, and the functional CSS fallback.
- `npm run build`: the static Vite build succeeds with relative asset paths. The initial application bundle is about 75 KB (30 KB gzip). The roughly 471 KB Three.js enhancement (119 KB gzip) loads separately.
- `npm run package:preview` and `npm run verify:preview`: the self-contained HTML executes in JSDOM under a file URL, uses no external fonts/scripts/styles, has no script errors, opens sections exclusively, preserves URL state, and restores focus on close.
- Responsive sizing was inspected in source and checked with the actual Archivo Black font advance widths at representative widths from 320px to 1920px. This caught a tight fit near the phone breakpoint, which was adjusted. This calculation does not verify browser layout or appearance.
- Text sizes: supporting text 16–18px; technical labels 13–14px; wordmark 17–18px. Foreground/background contrast was reviewed from the declared colors, including dark lettering on the three selection colors.

These tests do not establish visual quality or real GPU behavior. JSDOM has no layout engine or WebGL context, so it exercises the actual CSS fallback.

## Real-browser verification: still unavailable

The cloud browser was initialized successfully. The managed preview was attempted again and failed with:

`relay could not open browser port 4173: timed out waiting for relay readiness`

The development script was explicitly aligned with port 4173 and retried after that configuration change. The same relay failure remained; `sites-preview status` reported the preview stopped. The previous cloud-browser restriction on opening local `file:` URLs also remains a known limitation; it was not bypassed.

Therefore desktop and mobile appearance, actual hover animation quality, real Three.js rendering, touch behavior, and browser-level focus/scroll behavior remain **unverified**. No screenshots are presented as evidence of a visual review.

## Reproduce locally

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Check desktop and phone widths, all hover and keyboard states, touch activation, expanded empty states, back/forward history, and reduced motion. To test the portable artifact instead, run `npm run package:preview` and open `artifacts/Deddeh-preview.html` in your browser.

## Repository and deployment boundary

The existing repository was inspected: it had no commits or remote branches, and its default branch was `main`. The revised source belongs at the repository root. Generated previews, ZIP archives, `dist/`, and `node_modules/` are excluded from commits. There is no GitHub Actions deployment workflow or CNAME file. No production deployment or DNS change is part of this revision.
