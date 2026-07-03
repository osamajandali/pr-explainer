import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Load only the weights/subsets actually used, to keep font requests small.
const { fontFamily: sans } = loadInter("normal", {
  weights: ["400", "700", "800"],
  subsets: ["latin"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

// GitHub-dark inspired palette for an IDE-like look.
export const theme = {
  bg: "#0d1117",
  bgAlt: "#161b22",
  bgElevated: "#1c2128",
  border: "#30363d",
  text: "#e6edf3",
  textDim: "#8b949e",
  accent: "#58a6ff",
  green: "#3fb950",
  greenBg: "rgba(63, 185, 80, 0.15)",
  greenGutter: "rgba(63, 185, 80, 0.4)",
  red: "#f85149",
  redBg: "rgba(248, 81, 73, 0.15)",
  redGutter: "rgba(248, 81, 73, 0.4)",
  purple: "#bc8cff",
  yellow: "#d29922",
  fonts: { sans, mono },
} as const;

/** Status → color for file-change badges. */
export const statusColor = (status: string): string => {
  switch (status) {
    case "added":
      return theme.green;
    case "removed":
      return theme.red;
    case "renamed":
      return theme.purple;
    default:
      return theme.accent;
  }
};
