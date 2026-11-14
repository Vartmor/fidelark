import { z } from "zod";

/**
 * Fidelity classes, ordered from most to least portable.
 * The order is part of the contract: `worstFidelity` relies on it.
 */
export const FIDELITY_CLASSES = [
  "exact-portable",
  "bundled-portable",
  "semantic-equivalent",
  "connected",
  "static-fallback",
  "unsupported",
] as const;

export const FidelityClass = z.enum(FIDELITY_CLASSES);
export type FidelityClass = z.infer<typeof FidelityClass>;

export type FidelityDisplay = {
  /** Visual notation; never shown without the label (meaning must not rely on the glyph). */
  glyph: string;
  label: string;
  description: string;
};

/** User-facing notation from the brand guidelines (branding/brandbook/BRAND_GUIDELINES.md §05). */
export const FIDELITY_DISPLAY: Readonly<Record<FidelityClass, FidelityDisplay>> = {
  "exact-portable": {
    glyph: "●",
    label: "Exact portable",
    description: "Source semantics and behavior preserved independently.",
  },
  "bundled-portable": {
    glyph: "▣",
    label: "Bundled portable",
    description: "Dependencies packaged, verified in the target environment.",
  },
  "semantic-equivalent": {
    glyph: "≈",
    label: "Semantic equivalent",
    description: "Meaning preserved with different presentation.",
  },
  connected: {
    glyph: "↗",
    label: "Connected",
    description: "Some behavior requires network/API.",
  },
  "static-fallback": {
    glyph: "◧",
    label: "Static fallback",
    description: "Source/snapshot kept, not interactive.",
  },
  unsupported: {
    glyph: "×",
    label: "Unsupported",
    description: "Not safe or feasible; explain why.",
  },
};

export function fidelityLabel(c: FidelityClass): string {
  const { glyph, label } = FIDELITY_DISPLAY[c];
  return `${glyph} ${label}`;
}

/** Result for one fidelity axis, with the evidence that justifies it. */
export const AxisAssessment = z.strictObject({
  class: FidelityClass,
  evidence: z.array(z.string()),
});
export type AxisAssessment = z.infer<typeof AxisAssessment>;

/**
 * Content, visual and behavioral fidelity are measured separately.
 * A single percentage score is intentionally not part of the contract.
 */
export const FidelityAssessment = z.strictObject({
  overall: FidelityClass,
  axes: z.strictObject({
    content: AxisAssessment,
    visual: AxisAssessment,
    behavioral: AxisAssessment,
  }),
});
export type FidelityAssessment = z.infer<typeof FidelityAssessment>;

/** Returns the least portable of the given classes. */
export function worstFidelity(classes: readonly FidelityClass[]): FidelityClass {
  if (classes.length === 0) {
    throw new Error("worstFidelity requires at least one class");
  }
  let worst = 0;
  for (const c of classes) {
    worst = Math.max(worst, FIDELITY_CLASSES.indexOf(c));
  }
  return FIDELITY_CLASSES[worst] as FidelityClass;
}
