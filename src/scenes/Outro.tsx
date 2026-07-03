import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame } from "../components/SceneFrame";
import { enter, riseUp } from "../anim";
import { theme } from "../theme";
import type { Scene } from "../types";

type OutroScene = Extract<Scene, { type: "outro" }>;

export const Outro: React.FC<{ scene: OutroScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = enter(frame, fps, 0);
  const url = enter(frame, fps, 16);

  return (
    <SceneFrame
      durationInFrames={scene.durationInFrames}
      style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}
    >
      <div style={{ opacity: head, transform: riseUp(head, 50) }}>
        <div style={{ fontSize: 30, letterSpacing: 6, color: theme.accent, fontWeight: 700 }}>
          THAT'S THE WALKTHROUGH
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            marginTop: 22,
            maxWidth: 1500,
            lineHeight: 1.1,
          }}
        >
          {scene.summary}
        </div>
      </div>

      <div
        style={{
          marginTop: 52,
          opacity: url,
          transform: riseUp(url),
          fontFamily: theme.fonts.mono,
          fontSize: 34,
          color: theme.textDim,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: "16px 32px",
          background: theme.bgAlt,
        }}
      >
        {scene.url}
      </div>
    </SceneFrame>
  );
};
