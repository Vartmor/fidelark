export const REPO_URL = "https://github.com/Vartmor/fidelark";
export const CLI_URL = `${REPO_URL}#usage`;
export const ROADMAP_URL = `${REPO_URL}#roadmap`;
export const SECURITY_URL = `${REPO_URL}/blob/main/SECURITY.md`;
export const TRADEMARKS_URL = `${REPO_URL}/blob/main/TRADEMARKS.md`;

const issueBody = [
  "Which AI tool made it, and how did you save it?",
  "",
  "What stopped working after saving (layout, interaction, data, fonts)?",
  "",
  "Attach the file if you can. Please remove private conversations, keys and personal data first.",
].join("\n");

export const SHARE_URL = `${REPO_URL}/issues/new?${new URLSearchParams({
  title: "Artifact: ",
  body: issueBody,
}).toString()}`;

export const NAV_ITEMS = [
  { label: "How it works", href: "#how" },
  { label: "Fidelity", href: "#fidelity" },
  { label: "Principles", href: "#principles" },
  { label: "Status", href: "#status" },
] as const;

export type FidelityClass =
  | "exact-portable"
  | "bundled-portable"
  | "semantic-equivalent"
  | "connected"
  | "static-fallback"
  | "unsupported";

/**
 * Same notation as FIDELITY_DISPLAY in @fidelark/schema (kept here so the page does not ship
 * zod). tests/site-data.test.ts checks that both stay identical.
 */
export const FIDELITY: readonly {
  id: FidelityClass;
  glyph: string;
  label: string;
  description: string;
}[] = [
  {
    id: "exact-portable",
    glyph: "●",
    label: "Exact portable",
    description: "Source semantics and behavior preserved independently.",
  },
  {
    id: "bundled-portable",
    glyph: "▣",
    label: "Bundled portable",
    description: "Dependencies packaged, verified in the target environment.",
  },
  {
    id: "semantic-equivalent",
    glyph: "≈",
    label: "Semantic equivalent",
    description: "Meaning preserved with different presentation.",
  },
  {
    id: "connected",
    glyph: "↗",
    label: "Connected",
    description: "Some behavior requires network/API.",
  },
  {
    id: "static-fallback",
    glyph: "◧",
    label: "Static fallback",
    description: "Source/snapshot kept, not interactive.",
  },
  {
    id: "unsupported",
    glyph: "×",
    label: "Unsupported",
    description: "Not safe or feasible; explain why.",
  },
];

/** Short names for the test fixtures shown on the page, keyed by fixture id. */
export const FIXTURE_NAMES: Record<string, string> = {
  "minimal-quiz": "Quiz",
  "live-data-widget": "Live chart widget",
  "remote-assets": "Page with remote assets",
  "platform-host-api": "Tutor using a platform API",
  "static-article": "Static article",
  "react-babel-cdn": "React flashcards",
  "missing-local-files": "Page missing its files",
  "form-exfiltration": "Form posting elsewhere",
  "module-bare-import": "Bare module imports",
};
