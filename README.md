# Deddeh.com

A static personal index for writing, projects, and notes. One primary design, built around oversized navigation and a shared selection system. Every section is currently empty; no sample publications or personal claims are included.

The maintainable source lives at the repository root. A GitHub Actions workflow publishes a repository preview to GitHub Pages. There is no custom-domain configuration or backend.

## Preview locally

Use Node.js 22.12+; Node 24 was used for development.

```sh
git clone https://github.com/module7543/deddeh.com.git
cd deddeh.com
npm ci
npm run dev
```

Open **http://localhost:4173** in your browser. On another device on the same network, use the development machine’s LAN address and port 4173. This is a local development server, not a hosted production site.

Hover or focus Writing, Projects, or Notes to select it. Click, tap, Enter, or Space opens its empty state. Only one section opens at a time. Close or Escape returns focus to its heading. Tab navigates normally; the heading buttons also support Up/Down, Home, and End. Section URLs use `#writing`, `#projects`, and `#notes`; browser back/forward restores them.

The system’s reduced-motion preference makes changes immediate. If WebGL or the graphics module is unavailable, CSS keeps the same selection blocks and the index remains functional.

## Check and build

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` contains the static build, with relative asset URLs compatible with GitHub Pages. Build output and dependencies are ignored by Git. The Pages preview uses the repository URL only. Connecting the Deddeh.com domain remains a separate, unauthorized next step.

For an optional self-contained file preview:

```sh
npm run package:preview
npm run verify:preview
```

Open `artifacts/Deddeh-preview.html`. Fonts, styling, libraries, and graphics are embedded; no server or internet connection is needed. The generated file is ignored by Git. Do not open the unbuilt source `index.html` directly.

## Design and implementation

- **Archivo Black** gives the three navigation headings a common, blocky silhouette. **Space Grotesk** supports readable body text; **IBM Plex Mono** handles 13–14px labels. Supporting text is 16–18px.
- The same grid aligns numbers, headings, empty states, and controls. The page contains no introductory slogan, design switcher, floating study, or prototype explanation.
- Blue, green, and burnt orange belong to Writing, Projects, and Notes. Violet is reserved for keyboard focus. Selection blocks use dark text on the accent color.
- Three.js renders the selected text background. Its shallow folding edge sits inside the block’s right padding. GSAP coordinates that edge with the word’s slight movement and the inline section transition. There is no separate 3D scene to explore.
- Graphics load after the index becomes interactive, render only when needed, pause outside the viewport or in a hidden tab, and cap pixel ratio at 1.5.

Read [the design rationale](docs/DESIGN-REVIEW.md), [verification results and limitations](docs/VERIFICATION.md), and [third-party notices](docs/THIRD-PARTY-NOTICES.md).

## Source map

- `index.html` — one semantic index, section buttons, and real empty states.
- `src/style.css` — typography, grid, responsive layouts, selection/focus, and CSS graphics fallback.
- `src/main.js` — section state, keyboard/touch input, URL history, and GSAP transitions.
- `src/selection-field.js` — the progressively enhanced Three.js selection background.
- `tests/` — interaction tests; these are not visual tests.
- `scripts/` — optional portable-preview generation and DOM verification.

The managed preview relay remains unavailable in the current development environment. Real-browser visual, mobile, and GPU verification has not been completed; see the verification notes before assessing the design.

## GitHub Pages preview

The workflow in `.github/workflows/pages.yml` checks and builds the Vite app, uploads only `dist/`, and deploys it to:

https://module7543.github.io/deddeh.com/

In Settings → Pages, select **GitHub Actions** as the source if it is not already selected. A push to `main` starts the workflow; it also supports **Run workflow** from the Actions tab.

`npm run build:pages` explicitly builds asset URLs beneath `/deddeh.com/`, including the lazy-loaded Three.js module and fonts. Local development and the portable preview keep their existing paths. The workflow does not configure a custom domain, create a CNAME, or change DNS.
