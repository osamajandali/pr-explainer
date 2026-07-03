import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame } from "../components/SceneFrame";
import { enter } from "../anim";
import { theme } from "../theme";
import type { Scene } from "../types";

type StatsScene = Extract<Scene, { type: "stats" }>;

const useCountUp = (target: number, delay = 10, dur = 40): number => {
  const frame = useCurrentFrame();
  return Math.round(
    interpolate(frame, [delay, delay + dur], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
};

const Stat: React.FC<{ value: number; label: string; color: string; delay: number }> = ({
  value,
  label,
  color,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = enter(frame, fps, delay);
  const count = useCountUp(value, delay + 4);
  return (
    <div style={{ opacity: v, transform: `scale(${0.9 + v * 0.1})` }}>
      <div style={{ fontSize: 96, fontWeight: 800, color, fontFamily: theme.fonts.mono }}>
        {count.toLocaleString()}
      </div>
      <div style={{ fontSize: 30, color: theme.textDim, marginTop: 4 }}>{label}</div>
    </div>
  );
};

export const StatsSummary: React.FC<{ scene: StatsScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = enter(frame, fps, 0);
  const total = Math.max(1, scene.additions + scene.deletions);
  const addPct = (scene.additions / total) * 100;
  const barGrow = interpolate(frame, [20, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame durationInFrames={scene.durationInFrames}>
      <div style={{ opacity: head }}>
        <div style={{ fontSize: 28, letterSpacing: 5, color: theme.accent, fontWeight: 700 }}>
          BY THE NUMBERS
        </div>
      </div>

      <div style={{ display: "flex", gap: 90, marginTop: 36 }}>
        <Stat value={scene.filesChanged} label="files changed" color={theme.text} delay={10} />
        <Stat value={scene.additions} label="additions" color={theme.green} delay={16} />
        <Stat value={scene.deletions} label="deletions" color={theme.red} delay={22} />
        <Stat value={scene.commits} label="commits" color={theme.accent} delay={28} />
      </div>

      {/* additions vs deletions bar */}
      <div
        style={{
          marginTop: 40,
          height: 26,
          borderRadius: 999,
          overflow: "hidden",
          display: "flex",
          width: 1000,
          background: theme.bgElevated,
          transform: `scaleX(${barGrow})`,
          transformOrigin: "left",
        }}
      >
        <div style={{ width: `${addPct}%`, background: theme.green }} />
        <div style={{ width: `${100 - addPct}%`, background: theme.red }} />
      </div>

      {/* top files */}
      <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 16 }}>
        {scene.topFiles.slice(0, 5).map((f, i) => {
          const v = enter(frame, fps, 40 + i * 6);
          return (
            <div
              key={f.filename}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: v,
                fontSize: 28,
              }}
            >
              <span
                style={{
                  fontFamily: theme.fonts.mono,
                  color: theme.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 1050,
                }}
              >
                {f.filename}
              </span>
              <span style={{ color: theme.green }}>+{f.additions}</span>
              <span style={{ color: theme.red }}>−{f.deletions}</span>
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
};
