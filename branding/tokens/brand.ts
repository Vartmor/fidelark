// Fidelark design token values (source: tokens/*.json).
// Naming avoids color-role ambiguity in light and dark themes.
export const fidelarkColors = {
  "ink": "#152D2B",
  "inkDeep": "#0B201E",
  "paper": "#F6F3EC",
  "white": "#FFFFFF",
  "stone": "#E9E9E1",
  "line": "#CCD6D0",
  "muted": "#526A65",
  "mutedDark": "#A9C0B8",
  "signal": "#F18A63",
  "signalDeep": "#AF4524",
  "signalPale": "#FCE3D7",
  "mint": "#B8E4CC",
  "mintDeep": "#1E6C4E",
  "blue": "#3263A0",
  "bluePale": "#E3ECF5",
  "gold": "#955C16",
  "goldPale": "#F8EDD3",
  "danger": "#A13A3C",
  "dangerPale": "#FBE7E6",
  "surfaceDark": "#1C3835",
  "borderStrong": "#627A70"
} as const;
export const fidelarkSpace = Object.freeze({ unit: 4, contentMax: 1216, readingMax: 704 });
export const fidelarkFidelityClasses = ['exact-portable','bundled-portable','semantic-equivalent','connected','static-fallback','unsupported'] as const;
