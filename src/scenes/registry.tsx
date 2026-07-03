import React from "react";
import type { Scene } from "../types";
import { TitleCard } from "./TitleCard";
import { Overview } from "./Overview";
import { CommitTimeline } from "./CommitTimeline";
import { FileWalk } from "./FileWalk";
import { StatsSummary } from "./StatsSummary";
import { Outro } from "./Outro";

/** Map a scene to its visual component (discriminated on scene.type). */
export const renderScene = (scene: Scene): React.ReactNode => {
  switch (scene.type) {
    case "title":
      return <TitleCard scene={scene} />;
    case "overview":
      return <Overview scene={scene} />;
    case "commits":
      return <CommitTimeline scene={scene} />;
    case "fileWalk":
      return <FileWalk scene={scene} />;
    case "stats":
      return <StatsSummary scene={scene} />;
    case "outro":
      return <Outro scene={scene} />;
    default:
      return null;
  }
};
