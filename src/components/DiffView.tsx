import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import type { DiffLine } from "../types";

const FONT_SIZE = 25;
const LINE_HEIGHT = 38;
const GUTTER_W = 64;
const MARKER_W = 26;
const DIM_OPACITY = 0.26;
const TRANSITION = 26; // frames to ease from one snippet to the next

// Per-line "wipe in" emphasis when the camera lands on a snippet.
const LANDING_DELAY = 12; // frames after the snippet becomes active before sweeps start
const SWEEP_STAGGER = 4; // frames between consecutive changed lines
const SWEEP_DUR = 18; // frames for one line's sweep to run

/** A snippet's placement on the local (scene) timeline + which lines it spotlights. */
export interface WalkStep {
  fromFrame: number;
  durationInFrames: number;
  focusStart: number;
  focusEnd: number;
}

const lineBg = (kind: DiffLine["kind"]): string => {
  switch (kind) {
    case "add":
      return theme.greenBg;
    case "del":
      return theme.redBg;
    case "hunk":
      return theme.bgAlt;
    default:
      return "transparent";
  }
};

const marker = (kind: DiffLine["kind"]): { ch: string; color: string } => {
  switch (kind) {
    case "add":
      return { ch: "+", color: theme.green };
    case "del":
      return { ch: "-", color: theme.red };
    default:
      return { ch: "", color: theme.textDim };
  }
};

/** Left-to-right highlight that wipes across a changed line, then fades out. */
const SweepOverlay: React.FC<{ kind: DiffLine["kind"]; entrance: number }> = ({
  kind,
  entrance,
}) => {
  if ((kind !== "add" && kind !== "del") || entrance <= 0 || entrance >= 1) return null;
  const wipe = Math.min(entrance / 0.6, 1); // reveal in the first 60%
  const fade = 1 - Math.max(0, (entrance - 0.6) / 0.4); // fade out in the last 40%
  const rgb = kind === "add" ? "63, 185, 80" : "248, 81, 73";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        background: `rgba(${rgb}, ${0.5 * fade})`,
        clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
        pointerEvents: "none",
      }}
    />
  );
};

const Row: React.FC<{ line: DiffLine; opacity: number; accent: number; entrance: number }> = ({
  line,
  opacity,
  accent,
  entrance,
}) => {
  const shared: React.CSSProperties = {
    opacity,
    boxShadow: accent > 0.02 ? `inset 4px 0 0 rgba(88, 166, 255, ${accent})` : undefined,
  };

  if (line.kind === "hunk") {
    return (
      <div
        style={{
          height: LINE_HEIGHT,
          lineHeight: `${LINE_HEIGHT}px`,
          background: theme.bgAlt,
          color: theme.purple,
          paddingLeft: GUTTER_W + MARKER_W,
          fontFamily: theme.fonts.mono,
          fontSize: FONT_SIZE - 3,
          whiteSpace: "pre",
          overflow: "hidden",
          ...shared,
        }}
      >
        {line.tokens.map((t) => t.content).join("")}
      </div>
    );
  }

  const m = marker(line.kind);
  const above: React.CSSProperties = { position: "relative", zIndex: 1 };
  return (
    <div
      style={{
        display: "flex",
        height: LINE_HEIGHT,
        lineHeight: `${LINE_HEIGHT}px`,
        background: lineBg(line.kind),
        fontFamily: theme.fonts.mono,
        fontSize: FONT_SIZE,
        overflow: "hidden",
        position: "relative",
        ...shared,
      }}
    >
      <SweepOverlay kind={line.kind} entrance={entrance} />
      <span
        style={{
          ...above,
          width: GUTTER_W,
          flexShrink: 0,
          textAlign: "right",
          paddingRight: 12,
          color: theme.textDim,
          opacity: 0.65,
          userSelect: "none",
        }}
      >
        {line.newNo ?? line.oldNo ?? ""}
      </span>
      <span
        style={{
          ...above,
          width: MARKER_W,
          flexShrink: 0,
          textAlign: "center",
          color: m.color,
          fontWeight: 700,
        }}
      >
        {m.ch}
      </span>
      <code style={{ ...above, whiteSpace: "pre" }}>
        {line.tokens.map((t, i) => (
          <span key={i} style={{ color: t.color || theme.text }}>
            {t.content}
          </span>
        ))}
      </code>
    </div>
  );
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Renders a file's diff and moves a "camera" through it: it holds on the active
 * snippet while its narration plays, then eases (pans + cross-fades the highlight)
 * to the next snippet. Non-focused lines are dimmed for context.
 */
export const DiffView: React.FC<{
  lines: DiffLine[];
  maxHeight: number;
  steps: WalkStep[];
}> = ({ lines, maxHeight, steps }) => {
  const frame = useCurrentFrame();
  const totalHeight = lines.length * LINE_HEIGHT;
  const maxScroll = Math.max(0, totalHeight - maxHeight);
  const clamp = (v: number) => Math.min(Math.max(v, 0), maxScroll);

  const scrollForFocus = (s: WalkStep): number => {
    const focusTop = s.focusStart * LINE_HEIGHT;
    const focusH = (s.focusEnd - s.focusStart) * LINE_HEIGHT;
    const visibleH = Math.min(focusH, maxHeight);
    return clamp(focusTop - (maxHeight - visibleH) / 2);
  };

  // Active snippet + eased progress since it became active.
  let k = 0;
  for (let i = 0; i < steps.length; i++) if (frame >= steps[i].fromFrame) k = i;
  const cur = steps[k];
  const prev = k > 0 ? steps[k - 1] : cur;
  const rawP = interpolate(frame, [cur.fromFrame, cur.fromFrame + TRANSITION], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p = Easing.inOut(Easing.cubic)(rawP);

  // Smoothly pan from the previous snippet's framing to the current one.
  // For the very first snippet, drift in gently from slightly above.
  const targetPrev =
    k > 0 ? scrollForFocus(prev) : clamp(scrollForFocus(cur) - 70);
  const scroll = lerp(targetPrev, scrollForFocus(cur), p);

  const inFocus = (i: number, s: WalkStep) => (i >= s.focusStart && i < s.focusEnd ? 1 : 0);

  // Per-line: which snippet owns it, and its order among that snippet's changed lines
  // (drives the staggered "wipe in" when the camera lands on that snippet).
  const owner = new Array<number>(lines.length).fill(-1);
  const changedIdx = new Array<number>(lines.length).fill(-1);
  steps.forEach((s, si) => {
    let cj = 0;
    for (let i = s.focusStart; i < s.focusEnd && i < lines.length; i++) {
      owner[i] = si;
      if (lines[i].kind === "add" || lines[i].kind === "del") changedIdx[i] = cj++;
    }
  });

  const entranceFor = (i: number): number => {
    if (changedIdx[i] < 0 || owner[i] < 0) return 1;
    const startAt = steps[owner[i]].fromFrame + LANDING_DELAY + changedIdx[i] * SWEEP_STAGGER;
    return interpolate(frame, [startAt, startAt + SWEEP_DUR], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  return (
    <div style={{ height: maxHeight, overflow: "hidden", position: "relative" }}>
      <div style={{ transform: `translateY(${-scroll}px)` }}>
        {lines.map((line, i) => {
          const amt = lerp(inFocus(i, prev), inFocus(i, cur), p);
          return (
            <Row
              key={i}
              line={line}
              opacity={DIM_OPACITY + (1 - DIM_OPACITY) * amt}
              accent={amt}
              entrance={entranceFor(i)}
            />
          );
        })}
      </div>
    </div>
  );
};
