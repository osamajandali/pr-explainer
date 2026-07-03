import { GoogleGenAI, Type } from "@google/genai";
import type { PRData, RawFile } from "./github";

const DEFAULT_MODEL = "gemini-2.5-flash";

/** A file broken into snippet-sized code segments (input to narration). */
export interface SegmentedFile {
  filename: string;
  /** Code text for each segment, in reading order. */
  segments: string[];
}

/** Narration text; files[].segments[i] is the narration for code segment i. */
export interface NarrationScript {
  titleNarration: string;
  overviewNarration: string;
  overviewSummary: string;
  overviewBullets: string[];
  commitsNarration: string;
  files: { filename: string; segments: string[] }[];
  statsNarration: string;
  outroNarration: string;
  outroSummary: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    titleNarration: { type: Type.STRING },
    overviewNarration: { type: Type.STRING },
    overviewSummary: { type: Type.STRING },
    overviewBullets: { type: Type.ARRAY, items: { type: Type.STRING } },
    commitsNarration: { type: Type.STRING },
    files: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          filename: { type: Type.STRING },
          segments: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["filename", "segments"],
      },
    },
    statsNarration: { type: Type.STRING },
    outroNarration: { type: Type.STRING },
    outroSummary: { type: Type.STRING },
  },
  required: [
    "titleNarration",
    "overviewNarration",
    "overviewSummary",
    "overviewBullets",
    "commitsNarration",
    "files",
    "statsNarration",
    "outroNarration",
    "outroSummary",
  ],
};

function buildPrompt(pr: PRData, segmented: SegmentedFile[]): string {
  const commitList = pr.commits.map((c) => `- ${c.message} (${c.author})`).join("\n");

  const fileBlocks = segmented
    .map((f) => {
      const segs = f.segments
        .map((code, i) => `  [segment ${i + 1} of ${f.segments.length}]\n${code}`)
        .join("\n\n");
      return `FILE: ${f.filename}\n${segs}`;
    })
    .join("\n\n----------------------------------------\n\n");

  return `You are a senior software engineer giving a spoken, guided walkthrough of a GitHub pull request, reading the code SNIPPET BY SNIPPET so a reviewer understands the whole change and its context. The narration is voiced by text-to-speech.

STRICT STYLE RULES:
- Plain spoken English. No markdown, no bullet symbols, no code fences, no emojis.
- Do not read code character-by-character. EXPLAIN what each snippet does and why, in a natural speaking voice, referring to the important identifiers by name.
- Build a continuous story: each segment continues from the previous so the reviewer follows the reasoning end to end.
- 1 to 3 sentences per segment. Be concrete and useful, not filler.

PULL REQUEST
Title: ${pr.title}
Author: ${pr.author}
Branch: ${pr.headRef} into ${pr.baseRef}
Totals: ${pr.changedFiles} files changed, +${pr.additions} / -${pr.deletions}, ${pr.commits.length} commits

Description:
${pr.body.slice(0, 2000) || "(no description provided)"}

Commits:
${commitList || "(none)"}

FILES AND CODE SEGMENTS TO WALK THROUGH:
${fileBlocks || "(no textual diffs)"}

TASK — produce narration for these scenes:
- titleNarration: one or two sentences introducing the PR and its purpose.
- overviewNarration: a spoken summary of what this PR accomplishes overall.
- overviewSummary: a short on-screen headline (max ~14 words).
- overviewBullets: 3 to 5 very short on-screen bullet phrases (max ~8 words each).
- commitsNarration: briefly narrate how the work progressed across commits.
- files: an array. For EACH file above (same exact filename), return a "segments" array with ONE narration string per code segment, IN ORDER, matching the number of segments shown. The first segment of a file should briefly say what the file is and its role, then explain that snippet; later segments explain their snippet while continuing the story.
- statsNarration: narrate the overall size and shape of the change.
- outroNarration: a closing line wrapping up and inviting review.
- outroSummary: a short on-screen closing headline (max ~12 words).`;
}

// ---------- Mechanical fallback (no LLM) ----------

export function fallbackScript(pr: PRData, segmented: SegmentedFile[]): NarrationScript {
  const filesWord = pr.changedFiles === 1 ? "file" : "files";
  const short = (f: string) => f.split("/").pop() ?? f;
  return {
    titleNarration: `Pull request number ${pr.number} in ${pr.repo}: ${pr.title}, by ${pr.author}.`,
    overviewNarration:
      pr.body.trim().slice(0, 400) ||
      `This pull request changes ${pr.changedFiles} ${filesWord}, merging ${pr.headRef} into ${pr.baseRef}.`,
    overviewSummary: pr.title,
    overviewBullets: [
      `${pr.changedFiles} files changed`,
      `+${pr.additions} / -${pr.deletions} lines`,
      `${pr.commits.length} commits`,
      `${pr.headRef} → ${pr.baseRef}`,
    ],
    commitsNarration:
      pr.commits.length > 0
        ? `This work landed across ${pr.commits.length} commits, starting with ${pr.commits[0].message}.`
        : `This pull request has no separate commits listed.`,
    files: segmented.map((f) => ({
      filename: f.filename,
      segments: f.segments.map((_, i) =>
        i === 0
          ? `Let's look at ${short(f.filename)}. Here is the first part of the change.`
          : `Continuing in ${short(f.filename)}, this next part of the change.`,
      ),
    })),
    statsNarration: `In total, ${pr.changedFiles} ${filesWord} changed, with ${pr.additions} additions and ${pr.deletions} deletions across ${pr.commits.length} commits.`,
    outroNarration: `That's the full walkthrough of this pull request. You can review it on GitHub.`,
    outroSummary: `Ready for review`,
  };
}

/** Pick the top non-binary files to spotlight as their own diff scenes. */
export function spotlightFiles(pr: PRData, maxFiles = 6): RawFile[] {
  return pr.files.filter((f) => !f.binary && f.hunks.length > 0).slice(0, maxFiles);
}

/** Align the model's per-file segment narrations to the exact segment counts we render. */
function alignFiles(
  parsed: NarrationScript,
  segmented: SegmentedFile[],
  fallback: NarrationScript,
): NarrationScript["files"] {
  const byName = new Map(parsed.files.map((f) => [f.filename, f.segments]));
  return segmented.map((sf, idx) => {
    const got = byName.get(sf.filename) ?? [];
    const fb = fallback.files[idx].segments;
    const segments = sf.segments.map((_, i) => got[i]?.trim() || fb[i]);
    return { filename: sf.filename, segments };
  });
}

export async function buildScript(
  pr: PRData,
  segmented: SegmentedFile[],
): Promise<NarrationScript> {
  const fallback = fallbackScript(pr, segmented);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("No GEMINI_API_KEY set — using mechanical fallback narration.");
    return fallback;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(pr, segmented),
      config: { responseMimeType: "application/json", responseSchema, temperature: 0.4 },
    });
    const text = response.text;
    if (!text) throw new Error("empty response");
    const parsed = JSON.parse(text) as NarrationScript;
    if (!parsed.titleNarration || !Array.isArray(parsed.files)) {
      throw new Error("response missing required fields");
    }
    parsed.files = alignFiles(parsed, segmented, fallback);
    return parsed;
  } catch (err) {
    console.warn(`Gemini narration failed (${(err as Error).message}); using fallback.`);
    return fallback;
  }
}

// ---------- Standalone: `tsx scripts/script-gemini.ts <PR_URL>` ----------

if (import.meta.url === `file://${process.argv[1]}`) {
  await import("dotenv/config");
  const { parsePrUrl } = await import("./util");
  const { fetchPR } = await import("./github");
  const { tokenizeFile } = await import("./highlight");
  const { segmentLines, segmentText } = await import("./segments");
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: tsx scripts/script-gemini.ts <github-pr-url>");
    process.exit(1);
  }
  const { owner, repo, number } = parsePrUrl(url);
  const pr = await fetchPR(owner, repo, number);
  const segmented: SegmentedFile[] = [];
  for (const raw of spotlightFiles(pr)) {
    const lines = (await tokenizeFile(raw)).slice(0, 120);
    const segs = segmentLines(lines);
    segmented.push({ filename: raw.filename, segments: segs.map((s) => segmentText(lines, s)) });
  }
  const script = await buildScript(pr, segmented);
  console.log(JSON.stringify(script, null, 2));
}
