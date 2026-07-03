import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { fadeInOut } from "../anim";

/**
 * Full-frame background + fade in/out for a scene. Uses the scene's own
 * durationInFrames (passed explicitly) rather than the composition length.
 */
export const SceneFrame: React.FC<{
  durationInFrames: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ durationInFrames, style, children }) => {
  const frame = useCurrentFrame();
  const opacity = fadeInOut(frame, durationInFrames);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: theme.fonts.sans,
        opacity,
        padding: 110,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Plays a scene's narration; renders nothing when there is no audio. */
export const SceneAudio: React.FC<{ src: string }> = ({ src }) => {
  if (!src) return null;
  return <Audio src={staticFile(src)} />;
};
