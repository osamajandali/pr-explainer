import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  FPS,
  type DiffLine,
  type Scene,
  type VideoProps,
  type WalkSegment,
} from "../src/types";
import { fetchPR, type PRData, type RawFile } from "./github";
import { buildScript, spotlightFiles, type SegmentedFile } from "./script-gemini";
import { tokenizeFile } from "./highlight";
import { segmentLines, segmentText, type Segment } from "./segments";
import { estimateDuration, synthesizeAll } from "./tts";
import {
  OUT_DIR,
  ROOT,
  jobIdFor,
  parsePrUrl,
  propsPath,
} from "./util";

const TAIL_PADDING_FRAMES = 12; // silence after speech before the next scene
const MAX_DISPLAY_LINES = 120; // max diff lines kept per file
const MAX_FILES = 6; // max spotlighted files
const MAX_SEGMENT_LINES = 18; // snippet size when splitting a hunk
const MAX_SEGMENTS_PER_FILE = 5; // cap snippets (walkthrough steps) per file
const MAX_TOTAL_SEGMENTS = 16; // global cap across all files (bounds length + TTS cost)

const toFrames = (sec: number): number => Math.ceil(sec * FPS) + TAIL_PADDING_FRAMES;

interface PreparedFile {
  raw: RawFile;
  lines: DiffLine[];
  segments: Segment[];
  truncated: boolean;
}

interface Tts {
  audioSrc: string;
  durationSec: number;
}

function languageBreakdown(pr: PRData): { name: string; value: number }[] {
  const totals = new Map<string, number>();
  let grand = 0;
  for (const f of pr.files) {
    if (f.binary) continue;
    const changes = f.additions + f.deletions;
    if (changes === 0) continue;
    totals.set(f.language, (totals.get(f.language) ?? 0) + changes);
    grand += changes;
  }
  if (grand === 0) return [];
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, v]) => ({ name, value: Math.round((v / grand) * 100) }));
}

/** Tokenize + segment the spotlighted files, capping total segments globally. */
async function prepareFiles(pr: PRData): Promise<PreparedFile[]> {
  const prepared: PreparedFile[] = [];
  for (const raw of spotlightFiles(pr, MAX_FILES)) {
    const all = await tokenizeFile(raw);
    const lines = all.slice(0, MAX_DISPLAY_LINES);
    const segments = segmentLines(lines, MAX_SEGMENT_LINES, MAX_SEGMENTS_PER_FILE);
    prepared.push({
      raw,
      lines,
      segments,
      truncated: raw.truncated || all.length > MAX_DISPLAY_LINES,
    });
  }

  // Global segment budget: files are already sorted by significance.
  let budget = MAX_TOTAL_SEGMENTS;
  for (const p of prepared) {
    if (budget <= 0) {
      p.segments = [];
      continue;
    }
    if (p.segments.length > budget) {
      const keep = p.segments.slice(0, budget - 1);
      keep.push({ start: p.segments[budget - 1].start, end: p.lines.length });
      p.segments = keep;
    }
    budget -= p.segments.length;
  }
  return prepared.filter((p) => p.segments.length > 0);
}

const topFilesOf = (pr: PRData) =>
  [...pr.files]
    .filter((f) => !f.binary)
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, 5)
    .map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status,
    }));

/**
 * Builds the ordered list of narration texts, plus an assembler that turns the
 * TTS results (one per text, index-aligned) into the final scenes. Audio is
 * generated once for the whole list; file scenes consume one clip per snippet.
 */
function planVideo(pr: PRData, script: Awaited<ReturnType<typeof buildScript>>, prepared: PreparedFile[]) {
  const narrationByFile = new Map(script.files.map((f) => [f.filename, f.segments]));
  const texts: string[] = [];
  const add = (t: string): number => texts.push(t) - 1;

  const titleI = add(script.titleNarration);
  const overviewI = add(script.overviewNarration);
  const commitsI = pr.commits.length > 0 ? add(script.commitsNarration) : -1;

  const fileUnits = prepared.map((p) => {
    const narr = narrationByFile.get(p.raw.filename) ?? [];
    return p.segments.map((seg, i) => ({
      seg,
      unit: add(narr[i]?.trim() || `Looking at ${p.raw.filename}.`),
    }));
  });

  const statsI = add(script.statsNarration);
  const outroI = add(script.outroNarration);

  const assemble = (r: Tts[]): Scene[] => {
    const dur = (i: number) => toFrames(r[i].durationSec);
    const src = (i: number) => r[i].audioSrc;
    let sid = 0;
    const nid = () => `scene-${sid++}`;
    const scenes: Scene[] = [];

    scenes.push({
      id: nid(),
      type: "title",
      narration: texts[titleI],
      audioSrc: src(titleI),
      durationInFrames: dur(titleI),
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      head: pr.headRef,
      base: pr.baseRef,
    });

    scenes.push({
      id: nid(),
      type: "overview",
      narration: texts[overviewI],
      audioSrc: src(overviewI),
      durationInFrames: dur(overviewI),
      summary: script.overviewSummary,
      bullets: script.overviewBullets.slice(0, 5),
      labels: pr.labels,
    });

    if (commitsI >= 0) {
      scenes.push({
        id: nid(),
        type: "commits",
        narration: texts[commitsI],
        audioSrc: src(commitsI),
        durationInFrames: dur(commitsI),
        commits: pr.commits.slice(0, 12),
      });
    }

    prepared.forEach((p, fi) => {
      const segments: WalkSegment[] = fileUnits[fi].map(({ seg, unit }) => ({
        narration: texts[unit],
        audioSrc: src(unit),
        durationInFrames: dur(unit),
        focusStart: seg.start,
        focusEnd: seg.end,
      }));
      const total = segments.reduce((n, s) => n + s.durationInFrames, 0);
      scenes.push({
        id: nid(),
        type: "fileWalk",
        narration: segments.map((s) => s.narration).join(" "),
        audioSrc: "", // audio is played per-segment inside the scene
        durationInFrames: total,
        filename: p.raw.filename,
        language: p.raw.language,
        status: p.raw.status,
        additions: p.raw.additions,
        deletions: p.raw.deletions,
        lines: p.lines,
        truncated: p.truncated,
        segments,
      });
    });

    scenes.push({
      id: nid(),
      type: "stats",
      narration: texts[statsI],
      audioSrc: src(statsI),
      durationInFrames: dur(statsI),
      filesChanged: pr.changedFiles,
      additions: pr.additions,
      deletions: pr.deletions,
      commits: pr.commits.length,
      topFiles: topFilesOf(pr),
      languages: languageBreakdown(pr),
    });

    scenes.push({
      id: nid(),
      type: "outro",
      narration: texts[outroI],
      audioSrc: src(outroI),
      durationInFrames: dur(outroI),
      summary: script.outroSummary,
      url: pr.url,
    });

    return scenes;
  };

  return { texts, assemble };
}

function renderVideo(propsFile: string, jobId: string): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${jobId}.mp4`);
  console.log(`\n🎬 Rendering video → ${path.relative(ROOT, out)}`);
  const res = spawnSync(
    "npx",
    ["remotion", "render", "src/index.ts", "PRVideo", out, `--props=${propsFile}`],
    { stdio: "inherit", cwd: ROOT },
  );
  if (res.status !== 0) {
    throw new Error(`remotion render exited with code ${res.status}`);
  }
  console.log(`\n✅ Done: ${out}`);
}

async function main() {
  const args = process.argv.slice(2);
  const doRender = args.includes("--render");
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.error("Usage: npm run generate -- <github-pr-url>   (add --render to also produce the MP4)");
    process.exit(1);
  }

  const { owner, repo, number } = parsePrUrl(url);
  const jobId = jobIdFor(owner, repo, number);

  console.log(`\n📥 Fetching PR ${owner}/${repo}#${number} …`);
  const pr = await fetchPR(owner, repo, number);
  console.log(`   "${pr.title}" — ${pr.changedFiles} files, +${pr.additions}/-${pr.deletions}, ${pr.commits.length} commits`);

  console.log(`\n🔎 Reading diffs & splitting into snippets …`);
  const prepared = await prepareFiles(pr);
  const segmented: SegmentedFile[] = prepared.map((p) => ({
    filename: p.raw.filename,
    segments: p.segments.map((s) => segmentText(p.lines, s)),
  }));
  const totalSegments = prepared.reduce((n, p) => n + p.segments.length, 0);
  console.log(`   ${prepared.length} files → ${totalSegments} code snippets to narrate`);

  console.log(`\n✍️  Writing snippet-by-snippet narration …`);
  const script = await buildScript(pr, segmented);

  console.log(`\n🧩 Planning scenes …`);
  const { texts, assemble } = planVideo(pr, script, prepared);

  let results: Tts[];
  if (process.env.GEMINI_API_KEY?.trim()) {
    console.log(`\n🔊 Generating narration audio with Gemini TTS (${texts.length} clips) …`);
    results = await synthesizeAll(jobId, texts);
  } else {
    console.warn(
      "\n🔇 No GEMINI_API_KEY — building a SILENT video with estimated timing. Add the key to .env for narration.",
    );
    results = texts.map((t) => ({ audioSrc: "", durationSec: estimateDuration(t) }));
  }

  const scenes = assemble(results);
  const props: VideoProps = {
    jobId,
    meta: { owner, repo, number, title: pr.title, url: pr.url },
    scenes,
  };

  const propsFile = propsPath(jobId);
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));
  const totalFrames = scenes.reduce((n, s) => n + s.durationInFrames, 0);
  console.log(
    `\n📝 Wrote ${path.relative(ROOT, propsFile)} — ${scenes.length} scenes, ~${(totalFrames / FPS).toFixed(0)}s`,
  );

  if (doRender) {
    renderVideo(propsFile, jobId);
  } else {
    console.log(`\nPreview:  npm run studio   (load public/props/${jobId}.json)`);
    console.log(`Render:   npm run make -- ${url}`);
  }
}

main().catch((err) => {
  console.error("\n❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
