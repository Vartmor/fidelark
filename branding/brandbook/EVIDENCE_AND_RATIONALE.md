# Evidence register — Fidelark Brand 1.0

**Evidence date:** 14 November 2026. Research-backed **does not mean** the palette or symbol scientifically predicts trust, memorability or conversion. The distinction below matters.

## A. Requirements and directly testable constraints

| Decision | Grounding | Implementation | Verification |
|---|---|---|---|
| Text contrast | [WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum): 4.5:1 standard text, 3:1 large text. | Ink/paper as primary copy; `signalDeep` on paper, `signal` on deep ink. | `quality/contrast-audit.json`; validate each production state. |
| Non-text component contrast | [WCAG SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): necessary control graphics usually at least 3:1. | Deliberate strong control outline (`borderStrong`), distinct focus style. | Token pair test; production focus/control audits still needed. |
| Color never sole semantic channel | [WCAG SC 1.4.1](https://www.w3.org/TR/WCAG22/#use-of-color). | Fidelity labels retain icon and textual class as well as color. | Remove saturation / inspect monochrome render. |
| Text spacing adaptability | [WCAG SC 1.4.12](https://www.w3.org/TR/WCAG22/#text-spacing); spacing **override tolerance**, not compulsory default line-height. | 1.55 default body; fluid blocks, no fixed-height copy areas in core CSS. | Test user CSS overrides separately. |
| Recognition over recall | [Nielsen Norman Group, 2024](https://www.nngroup.com/articles/recognition-and-recall/). | Name the four stages and six fidelity classes in plain text instead of unlabeled icons. | Product usability study, not a branding validity test. |
| Actionable failure copy | [Nielsen Norman Group — Error Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/). | Disclose exact missing dependency and next safe action, never only a decorative red mark. | User testing and accessibility review. |
| Font licensing | [SIL OFL 1.1](https://openfontlicense.org/). | Inter-based font stack; vectorized logo paths, no font binaries packed. | Check any separately downloaded Inter/alternative license when redistributing. |

## B. Product documents supplied by the founder

- `deep-research-report.md`, 14 November 2026: argues against inventing a new universal format; identifies portability, fidelity, safety and preservation as the credible space.
- `portable_artifact_girisim_master_plani_v1.md`, 14 November 2026: sets `Import → Inspect → Preserve → Export`; the first ICP is developer/AI power-user; six classes of fidelity; local-first and honest portability.
- The *brand* is therefore configured to represent forensic clarity and durable artifacts, **not** a general-purpose AI chatbot or app builder.

## C. Creative judgments and hypotheses (not established science)

| Creative choice | Rationale | How to falsify |
|---|---|---|
| Open Fold symbol / two passing forms | Suggests transition with an intact central artifact and leaves a recognizable negative-space window. Original visual metaphor; not a measured cognitive effect. | 5-second recognition, 16/24/32 px comprehension and trademark similarity review. |
| Deep petrol instead of black | Editorial technical tone; visually calmer in large fields while giving high contrast. This is a design hypothesis; hue does not scientifically guarantee trust. | Comparative preference tests with the target ICP. |
| Warm archive paper | Breaks from overused cyber/neon dark UI while preserving excellent text contrast. | Test in browsers/real lighting and with users. |
| Coral signal | A recognizable brand-specific interruption. It is **not** a success or danger color and must not encode safety. | Distinctiveness test in competitive collage; check attention without distraction. |
| Strong outline serif-free wordmark | At a glance, readable in a developer tool context; exported path has stable appearance. | Legibility at 140px, 1-color and grayscale. |
| Functional mono micro-labels | Conveys audit/provenance structure with clear status labels. Not suitable for long paragraphs. | Task success and reading comfort in beta. |
| Minimal animation | Avoids masking fidelity warnings and respects reduced motion settings. | Compare task completion and preference. |

## D. Scientific integrity / claims we deliberately do not make

- No claims such as “green increases trust 23%” or “orange converts better” are made. Such universal effects would be misleading without controlled research on this product and audience.
- Neither WCAG contrast validation nor aesthetic consistency proves total accessibility. Keyboard, zoom, focus, screen reader, mobile and real component states still need a full test.
- The name, mark and art direction are **creative brand proposals**; search-engine absence is not trademark clearance or evidence of exclusivity.
- Audience memorability, color preference and brand differentiation remain empirical hypotheses. Small founder-led preference studies are directional rather than conclusive.

## E. Reference links (read directly)

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.nngroup.com/articles/recognition-and-recall/
- https://www.nngroup.com/articles/error-message-guidelines/
- https://openfontlicense.org/
- https://rsms.me/inter/ (official Inter project)
