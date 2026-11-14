# FIDELARK / Visual Identity Standards

**Version:** 1.0.0 (brand concept)  
**Date:** 14 November 2026  
**Status:** Ready for prototype, pending audience and trademark validation.  
**Primary language:** English global B2D; Turkish localization supported.

## 01 — Brand decision

**Category:** artifact portability, conversion, secure rendering and digital preservation infrastructure.  
**Position:** the open exit for interactive AI work; not another note app and not a universal format.  
**Core offer:** Import → Inspect → Preserve → Export.  
**Audience:** AI power users, developers, analysts; later SDK/platform teams.  
**Primary line:** **Your work. Beyond the chat.**  
**Explanatory line:** Keep AI-generated work usable beyond the platform where it was made.  
**Product proof:** sources, dependencies, permissions and fidelity class are inspectable; limitations are explicit.

### Brand pillars

1. **Ownership / Control.** Prefer local-first workflows; never imply possession of a third party's IP.
2. **Transparency.** Evidence over unexplained “X% portable” scores.
3. **Safety.** Unknown code is never auto-trusted.
4. **Interoperability.** Compatible outputs and integrations over format theater.
5. **Longevity.** Preserve semantics, originals and fallback paths.

### Brand behavior

Voice: precise, calm, technically literate, human. Imperatives are short. If a conversion fails, explain *why* and what remains usable. Avoid claiming complete compatibility with all closed tools. Avoid faux intimacy and generic motivational AI marketing.

## 02 — The identity idea: OPEN FOLD

**Concept:** Two complementary folds around an open, uninterrupted negative-space center. The separation is essential: it represents transport across boundaries, while the center stands for a preserved artifact. The symbol is *not* a literal lock, archive box, sparkle, paperclip, folder or cloud. It is a deliberately abstract transit system.

### Master construction

- Fixed design grid: **120 × 120 coordinate units**.
- Left master path: `M24 86 V25 H86 L73 41 H41 V73 Z`.
- Right master path: `M96 34 V95 H34 L47 79 H79 V47 Z`.
- Master geometry in `assets/logo/svg/symbol-*.svg`. Don't reconstruct by eye, redraw, stretch or round corners.
- Shapes form a visible central open field; the split version assigns mint to the upper-left and signal coral to the lower-right **only in display artwork**, not the tiny favicon.
- Master logotype is outlined from **Inter Display SemiBold**, 88 px at 2048 UPM, tracking -0.042 em; exported as SVG paths. Do not replace it with an arbitrary HTML text string when using a logo.
- Icon/wordmark master lockup gap: **16 / 120** of symbol artwork coordinates; lockup icon 120 units high. Do not tighten further. The files contain coordinate breathing room already.
- Clearance: at least **24 master units beyond the 120-unit symbol's total box** on every side; for lockups use the same scaled measure.
- All logo assets have transparent backgrounds except `symbol-on-*` explicitly backed variants.

### Minimum size

| Context | Minimum recommended |
|---|---:|
| Standalone symbol in UI | **32 CSS px** edge; 16 px is a simplified favicon-only context |
| Horizontal lockup, web | **140 CSS px** overall width (180+ preferred) |
| Print symbol | **9 mm** minimum edge |
| Print horizontal lockup | **40 mm** minimum width |
| Stroke-free master | SVG paths are solid shapes; no fragile line-art outline |

A 120-unit mark has an intentionally open form. At 16 CSS px, critical gaps may visually shrink; use provided favicon PNGs instead of deriving arbitrary resizes.

### Correct / incorrect

**Do:** 1-color ink on archive paper, paper on ink, coral on ink for limited highlights, keep consistent padding, preserve logo aspect ratio, use outlined wordmark master.  
**Don't:** mix new geometry with the master, put the mark inside an AI sparkle, apply glow or bevel, rotate the mark, fill the negative-space aperture, place coral as error/success meaning, recolor one half in six dashboard status colors.

## 03 — Chromatic system

| Token | Hex | Role |
|---|---|---|
| `inkDeep` | `#0B201E` | Dark background, hero, security surface |
| `ink` | `#152D2B` | Main type, primary light-theme button, primary vector logo |
| `paper` | `#F6F3EC` | Main editorial canvas, warmth without yellow cast |
| `white` | `#FFFFFF` | Form and document surfaces |
| `signal` | `#F18A63` | Expressive brand accent on **dark surfaces** and graphic illustration |
| `signalDeep` | `#AF4524` | Accessible accent copy or focus against **light surfaces** |
| `mint` | `#B8E4CC` | Brand illustration / exact-status surface context |
| `mintDeep` | `#1E6C4E` | Semantic positive text role |
| `blue` | `#3263A0` | Connected and optional links; always labeled |
| `gold` | `#955C16` | Caveat / partial preservation |
| `danger` | `#A13A3C` | Unsupported or errors, with explanation |
| `muted` | `#526A65` | Light background secondary content |
| `mutedDark` | `#A9C0B8` | Dark background secondary content |
| `line` | `#CCD6D0` | Only decorative divisions; **not** sole control boundary |
| `borderStrong` | `#627A70` | Necessary light-theme control boundaries |

**Distribution in editorial compositions (not a validated user preference):** ~65% calm primary surface, ~25% high-contrast ink or inverse, ~8% structural mint, ~2% signal. Never force this ratio onto accessibility or dashboards. Signal should be a visual signature, not a traffic light. Don't place unadjusted `signal` text on `paper`.

### Verified contrast pairs

See `quality/contrast-audit.csv` for the exact computed ratios. Examples: Ink / Paper: **13.14:1**; Muted / Paper: **5.25:1**; SignalDeep / Paper: **5.12:1**; Signal / InkDeep: **6.90:1**. WCAG 2.2 requires 4.5:1 for typical body copy. Individual status chip foreground/background pairs are also checked. Compliance cannot be inferred for arbitrary color mixing.

## 04 — Typography and layout

**Display:** `Inter Display, Inter, sans-serif`, weight 600, tracking -0.045 to -0.065 em, line-height 1.04–1.12.  
**Body:** `Inter, system-ui, sans-serif`, weights 400/500/600, 16 px/1.55 (default), 18–20 px hero body.  
**Technical labels:** `ui-monospace`, all caps only for 10–12px *short* metadata, letter spacing 0.08–0.14 em. Numbers use tabular numerals when aligned in columns.  
**Do not:** use monospace for paragraphs, letter-spaced body text, over-tight tracking on small controls or low-contrast decorative type.

| Role | Desktop | Mobile | Weight / leading |
|---|---|---|---|
| Hero | 108 px maximum | ≥52 px fluid | 600 / 1.045 |
| Page H1 | 68 px max | 36 px | 600 / 1.08 |
| Section H2 | 40 px max | 27 px | 600 / 1.14 |
| Body | 16–18 px | 16 px | 400 / 1.55 |
| UI labels | 13–14 px | 14 px | 600 / 1.3 |
| Metadata | 11–12 px | 11–12 px | mono 600 / 1.3 |

**Grid:** 4px base unit; component gaps 8/12/16/24/32/48/64; max site container 1216px; max reading width 704px. Desktop 12-column grid with 24px gutters; on compact screens one-column composition at <640px. Scale type fluidly with `clamp` instead of hard switching without context.  
**Corners:** 10px controls, 14px cards, 24px hero panels. **Borders:** 1px decorative; 1.5px focus-relevant controls. **Motion:** 120–180ms simple easing, avoid parallax, respect `prefers-reduced-motion`.

## 05 — Product semiotics

Fidelark's core UI communicates measured confidence. Six fidelity classes originate from the supplied business plan. **Status is not a gradient or fake portability score.**

| Fidelity | Visual notation | User-facing implication |
|---|---|---|
| `exact-portable` | `● Exact portable` | Source semantics and behavior preserved independently. |
| `bundled-portable` | `▣ Bundled portable` | Dependencies packaged, verified in the target environment. |
| `semantic-equivalent` | `≈ Semantic equivalent` | Meaning preserved with different presentation. |
| `connected` | `↗ Connected` | Some behavior requires network/API. |
| `static-fallback` | `◧ Static fallback` | Source/snapshot kept, not interactive. |
| `unsupported` | `× Unsupported` | Not safe or feasible; explain why. |

Use the full English name in audit reports, short labels in constrained chips, and explicit explanation below. For screen readers, put meaning in text, not only glyph. Do not use statuses as promises without output verification. `ui/demo.html` is a fictional sample design and must not be used as a working performance claim.

### Importer user journey

1. **Import** — what source is accepted? file type, size, account or upload policy clearly shown.
2. **Inspect** — list external assets, scripts, network behavior, permissions and data concerns.
3. **Preserve** — original source, manifest, fallback and integrity evidence.
4. **Export** — name target format, dependency and fidelity limitations, plus offline re-open outcome when tested.

## 06 — Visual grammar

1. **Open Fold:** use original shapes as a complete symbol or 2-color monumental graphic. Never redraw with shadows and gradients.
2. **Trace route:** 90-degree stepping path through four stages (`assets/illustrations/trace-route.svg`). Useful for lifecycle explainers, not arbitrary decoration.
3. **Evidence fields:** hairline grid, tiny labels, sections and quiet dividers. Use plenty of negative space.
4. **Offset blocks:** split mark halves emphasize transitions; reserve the signal coral for the transferred or contested edge.
5. **Product mockups:** show grounded field names, actionable reports and examples, with clear *demo* labeling unless backed by real test data.

Use photography sparingly. Prefer real screenshots, anonymized real files and reproducible visualizations over generic floating 3D folders, humanoid robots, abstract AI swirls and glowing neural meshes.

## 07 — Brand messaging

**Primary:** `Your work. Beyond the chat.`  
**Compact:** `An open exit for AI creations.`  
**Functional:** `Import. Inspect. Preserve. Export.`  
**Support:** `See what survives. Keep what matters.`  
**MVP hero:** `Keep AI work usable beyond the chat.`

Be careful with ownership: legal rights depend on source platform terms and intellectual property. “Your work” addresses user control and portability, not automatic legal title. Avoid *“Save every AI artifact flawlessly”*, *“100% offline every time”*, *“universal PDF replacement”*, *“end-to-end encrypted”* before that is implemented and verified.

## 08 — Surfaces and contexts

- Web landing: editorial paper + ink, split symbol in hero, headline left, actual inspection artifact right.
- Product workspace: interface contrast and status labels take priority; coral accent only in brand/CTA contexts.
- GitHub: monochrome logo, provenance-first README badges, no animated neon wallpaper.
- Presentations: 16:9 cover, large one-liners, sober evidence screenshots.
- Social: platform-specific size, do not resize `og` blindly into square avatar; use symbol for avatar.
- Print: use outlined SVG or proper PDF conversion; RGB HEX is a screen spec, *not* a certified CMYK recipe. Conduct press proof before offset print.

## 09 — Brand governance

This is a **professional prototype identity** not a legal clearance opinion. Fidelark is the candidate selected for creative development; it must pass Turkish and relevant international trademark screening, company-name search, domain/social handle checks and similarity screening before public rollout. Track any complaints or collisions. Do not imply `fidelark.*` domains are available without registrar confirmation.

### Handoff / ownership of files

- **SVG** is canonical. Export PNG from SVG for fixed use; don't edit raster and call it the master.
- **Paths** in wordmark SVGs make the appearance independent from installed fonts.
- **Tokens** are the source of color truth; don't sample PNG colors manually.
- **No fonts included**. Download fonts from official sources and comply with license and embedding terms.
- **No third-party images included**. System graphics and layouts are original generated visual proposals. Reuse according to your project's legal/IP policy; obtain trademark clearance before asserting exclusive commercial rights.

## 10 — Recommended validation before brand lock

1. Legal and visual similarity clearance in relevant markets/classes.
2. 5–8 target users: blind recognition vs logo/category decoy board; ask whether it reads as converter, storage, trust, AI or something else.
3. Small-size tests at 16/24/32/48 CSS px; printer proof at 9/12 mm.
4. Prototype usability test for the six status labels, content and contrast on actual devices; do not rely on visual assumptions.
5. Dark-mode and long-string QA including Turkish and German translations.
6. Measure trust, comprehension and preference in the actual product; never state that a color guarantees either.

---
**Canonical assets:** `assets/logo/svg/` • **Integration:** `tokens/brand.css` and `ui/components.css` • **Audit:** `quality/contrast-audit.json` • **Further rationale:** `EVIDENCE_AND_RATIONALE.md`.
