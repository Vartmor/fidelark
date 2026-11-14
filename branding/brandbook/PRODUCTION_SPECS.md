# Fidelark — production and handoff specs

## Units

- Digital master logo: `120×120` SVG viewBox and explicit path geometry. SVG is resolution independent. Horizontal logo viewBox is derived from glyph path width; never change aspect ratio.
- CSS: 4px spacing unit at the base size; responsive typography uses rem and clamp; actual `rem` size follows the user's browser settings.
- Physical print: mm, evaluated at production output. Keep at least 9 mm for the standalone mark and 40 mm for full lockup. Do not convert 120 user-space coordinate units directly into cm.
- Raster deliverables: sRGB RGBA/PNG. OG 1200×630, LinkedIn banner 1584×396, GitHub card 1280×640, cover 1920×1080, poster 3840×2160; favicons 16/32/48/64/180/192/512.
- PDF brand guide has vector text and should be proofed for final CMYK/ICC workflow if used for a real press run. No spot color/Pantone equivalence has been certified.

## Suggested print clearspace

Minimum clearspace on every side of the icon: 20% of its nominal 120-unit artboard, i.e. 24 units. At a 12mm icon nominal size, allocate at least 2.4mm additional clearspace beyond the artboard on all sides. Larger is better for signage.

## Logo modifications requiring a new brand revision

- Shape path changes (silhouette/topology), whitespace ratio, color roles, letter spacing, lockup separation, min size, icon corner rounding.
- New name or changes to the F/f initial.

## Figma / design-tool usage

- Import `assets/logo/svg/*.svg` directly (outlined vectors) and import `tokens/*.tokens.json` through a DTCG-compatible token workflow, checking support for aliases and complex values.
- Avoid copying screenshots of the brand board as source graphics.
- The `brand.css` and `ui/components.css` are runnable without a framework. Figma isn't required at build time.

## Accessibility QA

Contrast audit covers selected token pair values, not every dynamic UI state. Validate hover, disabled semantics, focus, form errors, keyboard navigation, zoom 200%, 320px narrow viewport, screen readers, translated strings and user-custom spacing.
