import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { PRVideo } from "./PRVideo";
import { FPS, WIDTH, HEIGHT, type VideoProps } from "./types";

// Total video length = sum of the per-scene (audio-derived) frame counts.
const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
  const total = props.scenes.reduce((n, s) => n + s.durationInFrames, 0);
  return { durationInFrames: Math.max(1, total) };
};

// Placeholder shown in Studio before a PR is generated / props are loaded.
const demoProps: VideoProps = {
  jobId: "demo",
  meta: { owner: "", repo: "remotion-pr", number: 0, title: "", url: "" },
  scenes: [
    {
      id: "scene-0",
      type: "title",
      narration: "",
      audioSrc: "",
      durationInFrames: 150,
      repo: "remotion-pr",
      number: 0,
      title: "Run  npm run generate -- <PR-URL>  to load a pull request",
      author: "you",
      head: "feature",
      base: "main",
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PRVideo"
      component={PRVideo}
      calculateMetadata={calculateMetadata}
      durationInFrames={150}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={demoProps}
    />
  );
};
