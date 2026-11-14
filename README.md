# Deddeh.com

A static personal homepage. Nothing is published yet, and the page is designed around that: a sheet of blocks stands in for unwritten text, and each section of the index re-typesets the same blocks.

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

- **One idea.** The sheet (Three.js, one instanced mesh of 141 blocks) is a blank ruled page with a cursor. Writing sets it as paragraphs, Projects as indented code with a run of added lines, Notes as loose cards at different heights. The pointer raises the blocks beneath it.
- **Type.** Archivo's width axis does the work: index words open from condensed to extended inside a selection block, and the large readout word is fitted to one measure by width, so every word fills the same line. Instrument Serif italic carries the aside; IBM Plex Mono the labels (13px minimum).
- **Motion.** GSAP drives the staggered re-typesetting, the readout's block wipe and the width changes. With reduced motion every change is immediate and the sheet renders only on change.
- **Input.** Hover or keyboard focus previews a section; click, tap, Enter or Space pins it (`#writing`, `#projects`, `#notes`); Escape or a second press clears it. Up/Down, Home and End move through the index.
- **Without WebGL** the page is complete; a ruled CSS sheet replaces the canvas.

## Source

- `index.html` — markup and copy.
- `src/style.css` — palette, type, layout.
- `src/main.js` — section state, readout fitting, GSAP choreography.
- `src/field.js` — the block sheet.
- `tests/`, `scripts/verify-pages.mjs` — interaction tests and the post-deploy browser check.

Third-party notices: [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
