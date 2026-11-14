# Revised design direction

## Navigation is the composition

The previous prototypes divided attention among an abstract headline, navigation, a separate spatial study, a comparison control, and explanatory labels. This revision replaces those regions with one index. The only large words are Writing, Projects, and Notes; the only supporting content states that nothing has been published.

All three headings share Archivo Black, a consistent scale, and the same left edge. A narrow editorial rail labels the index on desktop and becomes a single line above it on mobile. Numbers and controls align across rows. Empty-state text starts on the headings’ alignment axis rather than introducing another panel or modal layout.

The visual influence of a code-review interface appears through charcoal surfaces, deliberate rules, monospace indexing, and colored selection bands. There is no terminal, dashboard, fake activity, or programming metaphor in the content.

## Readable supporting type

Ordinary text is 18px, reducing to 16px on phones. Technical labels are 14px, reducing to 13px on narrow phones. The wordmark is 17–18px. The previous 8–11px labels have been removed. Oversized navigation scales with available width and height; the longest heading sets the narrow-screen fit constraints.

Archivo Black is deliberately heavier and broader than the previous condensed index. Warm off-white lettering and generous row spacing let the three words carry the page. Space Grotesk and IBM Plex Mono have supporting roles, with no arbitrary changes of weight or proportion.

## One selection system

Writing uses muted blue; Projects uses green; Notes uses burnt orange. The wordmark and editorial rail repeat orange, while violet identifies keyboard focus. Color follows an actual selection rather than separate decorative categories.

Hover, keyboard focus, an open section, or a touch activation drives one selected row. Its block highlight, dark lettering, number, and expand control respond together. The selected word moves four pixels within the same background. Each section expands in place and preserves the index around it.

Three.js implements that same selection background, including a shallow folding edge within its right padding. The text’s main background stays flat and legible while the edge turns. Pointer movement can gently bend the edge; focus receives the same activation transition, and touch receives it when opening a section. There is no separate Three.js object, graphic caption, drag target, or reset control.

GSAP coordinates the selection edge, the small typographic displacement, the initial entrance, and inline expansion. Reduced motion removes interpolation and pointer bending. CSS provides the same block design if WebGL is unavailable or its context is lost. Graphics render on demand rather than continuously.

## What to review next

This is one revised prototype, not an approved production design. Inspect the downloaded preview or run the source locally, especially at phone widths. Assess the strength of the three-word composition, the large type’s spacing, and whether the folding selection edge contributes enough to keep. The current environment did not permit real-browser visual QA, so that remains an explicit limitation rather than an approval claim.
