# Deddeh.com

A static personal homepage: an index of three sections (Writing, Projects, Contact) and one interactive sheet of blocks that re-typesets itself for each of them.

Preview: https://module7543.github.io/deddeh.com/ (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`). No custom domain, CNAME or DNS is configured.

## Run locally

Node.js 22.12+ (Node 24 in CI).

```sh
npm ci
npm run dev      # http://localhost:4173
npm run check    # syntax check
npm test         # interaction tests (jsdom, no WebGL)
npm run build    # static build in dist/
```

## Design

- **One scene.** The background is part of the Three.js scene: a ruled floor on the same grid as the blocks, lit by a soft pool of light that takes the active section's colour. The sheet (one instanced mesh of 141 blocks) stands on it and casts shadows; raised blocks cast longer ones.
- **Formations.** At rest: a ruled sheet with a cursor. Writing: prose with notes in the margin. Projects: indented code with a run of added lines. Contact: a postcard (message, divider, stamp, postmark, address lines). The pointer raises the blocks beneath it and lights the floor.
- **Type.** The index is the display type. Archivo's width axis opens the active word from condensed to extended inside its selection block. Instrument Serif italic carries the one-line statement for each section; IBM Plex Mono the figure caption and labels (13px minimum).
- **Colour.** Blue, green and orange belong to Writing, Projects and Contact. Choosing a section moves that colour through the word, the header marks, the statement bar, the caption and the floor light. Teal and violet appear only inside formations and focus rings.
- **Motion.** GSAP drives the staggered re-typesetting, the width changes and the text swaps. With reduced motion every change is immediate and the scene renders only on change.
- **Input.** Hover or keyboard focus previews a section; click, tap, Enter or Space pins it (`#writing`, `#projects`, `#contact`); Escape or a second press clears it. Up/Down, Home and End move through the index.
- **Without WebGL** the page is complete; a ruled CSS ground replaces the canvas.
- **Contact** is a section of the index only. There is no form, address or external service yet.

## Source

- `index.html` — markup and copy.
- `src/style.css` — palette, type, layout.
- `src/main.js` — section state, width fitting, GSAP choreography.
- `src/field.js` — the floor, the block sheet and its shadows.
- `tests/`, `scripts/verify-pages.mjs` — interaction tests and the post-deploy browser check.

Third-party notices: [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
