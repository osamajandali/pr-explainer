import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame } from "../components/SceneFrame";
import { enter, riseUp } from "../anim";
import { theme } from "../theme";
import type { Scene } from "../types";

type OverviewScene = Extract<Scene, { type: "overview" }>;

export const Overview: React.FC<{ scene: OverviewScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const head = enter(frame, fps, 0);

  return (
    <SceneFrame durationInFrames={scene.durationInFrames} style={{ justifyContent: "center" }}>
      <div style={{ opacity: head, transform: riseUp(head) }}>
        <div
          style={{
            fontSize: 28,
            letterSpacing: 5,
            color: theme.accent,
            fontWeight: 700,
          }}
        >
          OVERVIEW
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, marginTop: 18, maxWidth: 1600, lineHeight: 1.12 }}>
          {scene.summary}
        </div>
      </div>

      {scene.labels.length > 0 && (
        <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
          {scene.labels.map((l, i) => {
            const v = enter(frame, fps, 18 + i * 4);
            return (
              <span
                key={l}
                style={{
                  opacity: v,
                  fontSize: 26,
                  padding: "8px 20px",
                  borderRadius: 999,
                  background: theme.bgElevated,
                  border: `1px solid ${theme.accent}`,
                  color: theme.accent,
                }}
              >
                {l}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 22 }}>
        {scene.bullets.map((b, i) => {
          const v = enter(frame, fps, 30 + i * 12);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                opacity: v,
                transform: `translateX(${(1 - v) * -30}px)`,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: theme.accent,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 40, color: theme.text }}>{b}</span>
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
};
