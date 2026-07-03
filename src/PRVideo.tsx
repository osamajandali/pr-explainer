import React from "react";
import { AbsoluteFill, Series } from "remotion";
import type { VideoProps } from "./types";
import { theme } from "./theme";
import { SceneAudio } from "./components/SceneFrame";
import { renderScene } from "./scenes/registry";

/**
 * Chains scenes back-to-back. Each Series.Sequence runs for exactly its
 * audio-derived durationInFrames, so visuals never drift from the narration.
 */
export const PRVideo: React.FC<VideoProps> = ({ scenes }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
            <SceneAudio src={scene.audioSrc} />
            {renderScene(scene)}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
