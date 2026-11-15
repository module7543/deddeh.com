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
- **Signature.** Two details, no more. The plain sheet carries a watermark, a D four cells wide and eight rows tall: invisible at rest, it stays flat and turns warm where the pointer's light passes over it, and it is gone the moment the sheet is typeset. The open postcard is addressed "To Sam Deddeh", in the serif the statements are set in; that is the only place the name is written.
- **Type.** The index is the display type. Archivo's width axis opens the active word from condensed to extended inside its selection block. Instrument Serif italic carries the one-line statement for each section; IBM Plex Mono the figure caption and labels (13px minimum).
- **Colour.** Blue, green and orange belong to Writing, Projects and Contact. Choosing a section moves that colour through the word, the header marks, the statement bar, the caption and the floor light. Teal and violet appear only inside formations and focus rings.
- **Motion.** GSAP drives the staggered re-typesetting, the width changes and the text swaps. With reduced motion every change is immediate and the scene renders only on change.
- **Input.** Hover or keyboard focus previews a section; click, tap, Enter or Space pins it (`#writing`, `#projects`, `#contact`); Escape or a second press clears it. Up/Down, Home and End move through the index.
- **Without WebGL** the page is complete; a ruled CSS ground replaces the canvas.
- **Contact** opens a postcard you can write on. Hovering Contact only previews it; click, tap, Enter or Space opens the form, and Close, Escape or choosing another section leaves it (what was typed is kept). The blocks lie flat behind the form and become its frame, ruled lines, field underlines, stamp and postmark; the focused field's rule turns orange, an invalid one coral.

## Contact form

- Submissions go to the Formspree form `moedjgda` through `@formspree/ajax` (`src/contact.js`). The form id is public by design; no credentials, tokens or receiving address are in this repository.
- Fields: Name (optional), Email, Message, plus Formspree's hidden `_gotcha` honeypot. The page validates before sending, sends once however often Send is pressed, and shows "Posted" only after Formspree answers with success.
- If a send fails, the message stays in place with "Try again", and a link sends the same form through Formspree's own page in a new tab (where Formspree can show its own checks).
- Tests and the post-deploy browser check always mock Formspree. Nothing in CI spends a real submission.
- To check a branch build locally: `npm run build && npm run preview`, then `PREVIEW_URL=http://localhost:4173/ npm run verify:pages` (set `CHROMIUM_PATH` if Playwright's own browser is not installed).

## Source

- `index.html` — markup and copy.
- `src/style.css` — palette, type, layout.
- `src/main.js` — section state, width fitting, GSAP choreography.
- `src/field.js` — the floor, the block sheet and its shadows, and the flat postcard mode.
- `src/contact.js` — the Contact postcard: validation, Formspree submission, and the blocks drawn behind the form.
- `tests/`, `scripts/verify-pages.mjs` — interaction tests and the post-deploy browser check.

Third-party notices: [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
