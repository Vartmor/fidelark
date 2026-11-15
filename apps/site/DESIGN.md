# Fidelark site: design system

**Design read:** open-source developer-tool landing for technical AI users, in an
evidence-first editorial-technical language (archive paper + audit ink), built on Tailwind v4,
shadcn-style owned components and Motion, around one signature interactive product demo.

**Dials:** variance 7, motion 6, density 4. Light page; one deliberate ink color block.

Brand rules in `branding/brandbook/` win over any reference or skill default.

## Sources and what was taken

| Source | Taken | Not taken |
|---|---|---|
| Single-viewport hero reference | 3-row frame (header, hero, facts row), bottom-anchored copy, 3-column header grid, solid + frosted buttons with a shine sweep, staged entrance timings, height-aware scaling, full-screen mobile menu | Black page, serif accent word, AI sparkle badge, video background |
| Scanner/belt reference | Light page, one hot accent, a belt of real mini pages crossing a scanner line, particle dissolve, the "what the machine sees" side, a live counter, drag with inertia | Serif display, glow intensity, third-party photos |
| UI UX Pro Max | Trust + product-demo section order, pause control for moving content, 1-2 animated elements per view, transform/opacity only | Its default dark slate + green palette and mono headings (conflict with the brand) |
| Taste skill | Brief read, no serif, one accent, no em dashes, hero stack of 4, eyebrow budget, no repeated layout families, motion must mean something | Its default to avoid Inter and warm paper (the brand defines both) |

## Color

| Role | Token | Use |
|---|---|---|
| Canvas | `paper` #F6F3EC | Page background |
| Text | `ink` #152D2B | Headlines, body |
| Secondary text | `slate` #526A65 | Lede, captions (5.25:1 on paper) |
| Accent | `signal` #F18A63 | Scanner line, particles, fold artwork only; never body text on paper |
| Accent text | `signal-deep` #AF4524 | Links and accent text on paper (5.12:1) |
| Structure | `mint` #B8E4CC | Fold artwork, exact-portable chip, surface tints |
| Color block | `ink-deep` #0B201E | One section (Principles) |

Fidelity chips use the audited pairs from `branding/ui/components.css` and always show glyph +
label; color is never the only signal.

## Type

Inter Variable with the optical-size axis (`opsz` 32 for display, auto for text), self-hosted.
Display: weight 600, tracking -0.045em, leading 1.04. Emphasis inside a headline uses the same
family in `slate`, never a second family. Mono (`ui-monospace`) only for commands, reports and
short labels.

## Shape

Controls (buttons, nav pills, inputs): 10px. Content cards and belt cards: 14px. Large panels
and bento cells: 24px. Hairlines are 1px `line`; control borders are `border-strong`.

## Layout

Max content width 1216px, reading width 704px, 4px spacing grid. Breakpoints 640 / 768 / 1024 /
1280 / 1600 / 1920. Every multi-column section declares its single-column fallback below 768px.

Section order and layout families (no family repeats):

1. Hero: 3-row frame, copy bottom-left, monumental split Open Fold right, facts row.
2. See what survives: full-bleed belt with scanner line (interactive demo).
3. How it works: three verbs on a stepped trace path.
4. Fidelity: one ordered horizontal scale with six stops.
5. Principles: ink color block, asymmetric bento.
6. Status: two-column checklist (works today / next).
7. Closing call: editorial statement with two actions.
8. Footer.

Eyebrows: at most 3 on the page.

## Motion

Entrances use `cubic-bezier(0.16, 1, 0.3, 1)` around 1s with staggered delays; micro-interactions
120-200ms; shine sweep 650ms. Every animation states a cause: the hero sequence sets reading
order, the fold halves close to show transfer, the belt shows inspection, the trace path shows
the flow. With `prefers-reduced-motion`, everything is static and the belt stops (it can still
be dragged). The belt runs only while visible and has a pause control.

## Honesty

No invented numbers, logos or testimonials. Reports on the belt are real `fidelark inspect`
output for the repository's fixtures, computed on every build (`virtual:site-reports` in
`vite.config.ts`), so they cannot go stale. The project is pre-alpha and the page
says so in the Status section.
