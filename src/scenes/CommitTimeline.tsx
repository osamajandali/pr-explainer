import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame } from "../components/SceneFrame";
import { enter } from "../anim";
import { theme } from "../theme";
import type { Scene } from "../types";

type CommitsScene = Extract<Scene, { type: "commits" }>;

export const CommitTimeline: React.FC<{ scene: CommitsScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = enter(frame, fps, 0);
  const shown = scene.commits.slice(0, 8);
  const extra = scene.commits.length - shown.length;

  return (
    <SceneFrame durationInFrames={scene.durationInFrames}>
      <div style={{ opacity: head }}>
        <div style={{ fontSize: 28, letterSpacing: 5, color: theme.accent, fontWeight: 700 }}>
          COMMITS
        </div>
        <div style={{ fontSize: 60, fontWeight: 800, marginTop: 12 }}>
          {scene.commits.length} commit{scene.commits.length === 1 ? "" : "s"}
        </div>
      </div>

      <div style={{ marginTop: 40, position: "relative", paddingLeft: 40 }}>
        <div
          style={{
            position: "absolute",
            left: 11,
            top: 12,
            bottom: 12,
            width: 3,
            background: theme.border,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {shown.map((c, i) => {
            const v = enter(frame, fps, 12 + i * 8);
            return (
              <div
                key={c.sha + i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  opacity: v,
                  transform: `translateX(${(1 - v) * -24}px)`,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: theme.accent,
                    border: `4px solid ${theme.bg}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 26,
                    color: theme.yellow,
                    background: theme.bgElevated,
                    padding: "4px 14px",
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                >
                  {c.sha}
                </span>
                <span
                  style={{
                    fontSize: 34,
                    color: theme.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 1150,
                  }}
                >
                  {c.message}
                </span>
                <span style={{ fontSize: 26, color: theme.textDim, flexShrink: 0 }}>
                  {c.author}
                </span>
              </div>
            );
          })}
        </div>
        {extra > 0 && (
          <div style={{ marginTop: 22, fontSize: 30, color: theme.textDim, paddingLeft: 4 }}>
            + {extra} more commit{extra === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </SceneFrame>
  );
};
