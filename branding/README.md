# Fidelark — Branding System v1.0

This folder is a self-contained **production-ready brand-asset baseline** for a *proposed* identity. Place the `branding/` directory at the root of the Fidelark project. It contains originals, source SVGs, exported PNGs, reusable CSS/TypeScript tokens, an interactive design-only UI preview, evidence and a brandbook. It does **not** contain a real converter application.

## Start here

1. View `assets/posters/brand-system-3840x2160.png` for the overall direction.
2. Read `brandbook/BRAND_GUIDELINES.md` for exact sizes, space, colors, visual grammar and do/don't rules.
3. Use `assets/logo/svg/lockup-ink.svg` on the warm background; `lockup-paper.svg` on the deep dark background; `symbol-ink.svg` when an app icon is needed.
4. Load `tokens/brand.css` then `ui/components.css` in your web product. `ui/demo.html` previews theme switching and basic UI layout locally.
5. Set your favicon to `assets/favicon/favicon.svg`, use provided PNG variants for devices and `site.webmanifest` when appropriate.
6. Inspect `quality/contrast-audit.csv` before modifying tokens. Re-run the included `scripts/verify_brand.py` after asset changes.

## Important locations

```text
branding/
├── README.md
├── assets/
│   ├── logo/svg/                 # MASTER: symbol, custom outlined wordmark, lockups
│   ├── logo/png/                 # ready raster assets
│   ├── favicon/                  # favicon, apple touch, PWA icons
│   ├── patterns/                 # vector gates
│   ├── illustrations/            # trace system + clearspace illustration
│   ├── posters/                  # large 3840×2160 identity master and preview
│   └── social/                   # open graph, banner, GitHub artwork
├── tokens/                      # DTCG-style JSON, CSS custom properties, TS constants
├── ui/                          # CSS components and runnable design mock
├── templates/                   # print letterhead, presentation cover, brand cards
├── brandbook/                   # rules, evidence, copy, print specs, name/IP note, PDF
├── quality/                     # calculated contrast + asset SHA256 manifest
├── scripts/                     # local validation helpers
└── sources/                     # links / grounding notes
```

## Integration example

```tsx
import '../../branding/tokens/brand.css';
import '../../branding/ui/components.css';

export function InspectAction() {
  return <button type="button" className="f-btn f-btn-primary">Inspect a file</button>;
}
```

For local preview, run `python -m http.server 8765` in the repository root, then navigate to `/branding/ui/demo.html`. The preview contains **no real file analysis or upload** and has no remote analytics dependencies.

## Maintainer rules

- Treat SVG as source of truth. Do not edit exported PNG for the master logo.
- Wordmark SVG uses vector paths; installed fonts are not necessary to render the logo.
- Avoid borrowing a screenshot of a working product feature that does not yet exist.
- Use `signal` as a brand accent, not as the only success/error indicator.
- This is **v1 candidate identity**. Trademark/visual similarity validation is still required.
- No font binaries are included; download Inter from the official source if you need font files for your deployed site.

**Brand thesis:** `Your work. Beyond the chat.` • **System:** `Import / Inspect / Preserve / Export`.
