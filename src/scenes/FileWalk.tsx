import React from "react";
import { interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame, SceneAudio } from "../components/SceneFrame";
import { DiffView, type WalkStep } from "../components/DiffView";
import { enter } from "../anim";
import { theme, statusColor } from "../theme";
import type { Scene } from "../types";

type FileWalkScene = Extract<Scene, { type: "fileWalk" }>;

const Badge: React.FC<{ children: React.ReactNode; color: string }> = ({
  children,
  color,
}) => (
  <span style={{ fontFamily: theme.fonts.mono, fontSize: 26, color, fontWeight: 700 }}>
    {children}
  </span>
);

export const FileWalk: React.FC<{ scene: FileWalkScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = enter(frame, fps, 0);
  const body = enter(frame, fps, 8);

  // Lay each segment out on the local timeline, back to back.
  let acc = 0;
  const steps: WalkStep[] = scene.segments.map((s) => {
    const step: WalkStep = {
      fromFrame: acc,
      durationInFrames: s.durationInFrames,
      focusStart: s.focusStart,
      focusEnd: s.focusEnd,
    };
    acc += s.durationInFrames;
    return step;
  });

  // Which snippet is active right now (for the "part i/n" indicator).
  let active = 0;
  for (let i = 0; i < steps.length; i++) if (frame >= steps[i].fromFrame) active = i;

  // Reading progress through the file + tick marks at snippet boundaries.
  const progress = interpolate(frame, [0, scene.durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const boundaries = steps
    .slice(1)
    .map((s) => (s.fromFrame / scene.durationInFrames) * 100);

  const viewportHeight = 1080 - 90 * 2 - 110 - 22;

  return (
    <SceneFrame durationInFrames={scene.durationInFrames} style={{ padding: 90 }}>
      {scene.segments.map((s, i) => (
        <Sequence key={i} from={steps[i].fromFrame} durationInFrames={s.durationInFrames}>
          <SceneAudio src={s.audioSrc} />
        </Sequence>
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: head,
          marginBottom: 24,
        }}
      >
        <span
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 34,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          {scene.filename}
        </span>
        <span
          style={{
            fontSize: 22,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: statusColor(scene.status),
            border: `1px solid ${statusColor(scene.status)}`,
            borderRadius: 6,
            padding: "3px 12px",
          }}
        >
          {scene.status}
        </span>
        {scene.segments.length > 1 && (
          <span
            style={{
              fontSize: 22,
              color: theme.textDim,
              background: theme.bgElevated,
              borderRadius: 6,
              padding: "3px 12px",
            }}
          >
            part {active + 1}/{scene.segments.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <Badge color={theme.green}>+{scene.additions}</Badge>
        <Badge color={theme.red}>−{scene.deletions}</Badge>
        {scene.truncated && (
          <span style={{ fontSize: 22, color: theme.textDim }}>diff clipped</span>
        )}
      </div>

      {/* reading-progress bar with a tick at each snippet boundary */}
      <div
        style={{
          position: "relative",
          height: 6,
          borderRadius: 3,
          background: theme.bgElevated,
          margin: "0 0 16px",
          opacity: head,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress * 100}%`,
            background: theme.accent,
            borderRadius: 3,
          }}
        />
        {boundaries.map((pct, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${pct}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: theme.bg,
            }}
          />
        ))}
      </div>

      <div
        style={{
          opacity: body,
          border: `1px solid ${theme.border}`,
          borderRadius: 14,
          background: theme.bgAlt,
          overflow: "hidden",
        }}
      >
        <DiffView lines={scene.lines} maxHeight={viewportHeight} steps={steps} />
      </div>
    </SceneFrame>
  );
};
