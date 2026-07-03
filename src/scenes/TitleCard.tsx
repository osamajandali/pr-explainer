import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame } from "../components/SceneFrame";
import { enter, riseUp } from "../anim";
import { theme } from "../theme";
import type { Scene } from "../types";

type TitleScene = Extract<Scene, { type: "title" }>;

export const TitleCard: React.FC<{ scene: TitleScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrow = enter(frame, fps, 0);
  const title = enter(frame, fps, 8);
  const meta = enter(frame, fps, 20);
  const branch = enter(frame, fps, 30);

  return (
    <SceneFrame
      durationInFrames={scene.durationInFrames}
      style={{ justifyContent: "center" }}
    >
      <div style={{ opacity: eyebrow, transform: riseUp(eyebrow) }}>
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            color: theme.accent,
            fontWeight: 700,
          }}
        >
          PULL REQUEST
        </div>
        <div style={{ fontSize: 34, color: theme.textDim, marginTop: 8 }}>
          {scene.repo}{" "}
          <span style={{ color: theme.accent }}>#{scene.number}</span>
        </div>
      </div>

      <div
        style={{
          fontSize: 84,
          fontWeight: 800,
          lineHeight: 1.08,
          marginTop: 40,
          maxWidth: 1500,
          opacity: title,
          transform: riseUp(title, 60),
        }}
      >
        {scene.title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginTop: 48,
          fontSize: 36,
          opacity: meta,
          transform: riseUp(meta),
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: theme.accent,
            color: theme.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 32,
          }}
        >
          {(scene.author[0] ?? "?").toUpperCase()}
        </div>
        <span style={{ color: theme.textDim }}>by</span>
        <span style={{ fontWeight: 700 }}>{scene.author}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 40,
          opacity: branch,
          transform: riseUp(branch),
        }}
      >
        <Pill>{scene.head}</Pill>
        <span style={{ fontSize: 40, color: theme.textDim }}>→</span>
        <Pill>{scene.base}</Pill>
      </div>
    </SceneFrame>
  );
};

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontFamily: theme.fonts.mono,
      fontSize: 30,
      padding: "10px 24px",
      borderRadius: 999,
      background: theme.bgElevated,
      border: `1px solid ${theme.border}`,
      color: theme.text,
    }}
  >
    {children}
  </span>
);
