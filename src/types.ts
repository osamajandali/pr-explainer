// Shared contract between the prep pipeline (scripts/) and the Remotion render (src/).
// The generated public/props/<jobId>.json file is exactly a `VideoProps` object.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** A syntax-highlighted segment of a line (color pre-computed by Shiki in prep). */
export interface Token {
  content: string;
  color: string;
}

export type DiffLineKind = "add" | "del" | "ctx" | "hunk";

export interface DiffLine {
  kind: DiffLineKind;
  tokens: Token[];
  /** 1-based line numbers in the old/new file, or null when not applicable. */
  oldNo: number | null;
  newNo: number | null;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface FileStat {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
}

interface SceneBase {
  id: string;
  /** Spoken narration for this scene (also usable as an on-screen caption). */
  narration: string;
  /** Path relative to public/, e.g. "audio/<jobId>/scene-0.mp3". Empty if silent. */
  audioSrc: string;
  /** DERIVED from the measured audio length — never authored by hand. */
  durationInFrames: number;
}

/** One narrated snippet within a file walkthrough. */
export interface WalkSegment {
  narration: string;
  audioSrc: string; // empty if silent
  durationInFrames: number;
  focusStart: number; // inclusive index into lines
  focusEnd: number; // exclusive index into lines
}

export type Scene =
  | (SceneBase & {
      type: "title";
      repo: string;
      number: number;
      title: string;
      author: string;
      head: string;
      base: string;
    })
  | (SceneBase & {
      type: "overview";
      summary: string;
      bullets: string[];
      labels: string[];
    })
  | (SceneBase & { type: "commits"; commits: CommitInfo[] })
  | (SceneBase & {
      type: "fileWalk";
      filename: string;
      language: string;
      status: string;
      additions: number;
      deletions: number;
      lines: DiffLine[];
      truncated: boolean;
      /** Ordered snippets; the camera holds on each while its narration plays. */
      segments: WalkSegment[];
    })
  | (SceneBase & {
      type: "stats";
      filesChanged: number;
      additions: number;
      deletions: number;
      commits: number;
      topFiles: FileStat[];
      languages: { name: string; value: number }[];
    })
  | (SceneBase & { type: "outro"; summary: string; url: string });

export type SceneType = Scene["type"];

export interface VideoMeta {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
}

// NOTE: a `type` alias (not `interface`) so it satisfies Remotion's
// `Record<string, unknown>` props constraint.
export type VideoProps = {
  jobId: string;
  meta: VideoMeta;
  scenes: Scene[];
};
