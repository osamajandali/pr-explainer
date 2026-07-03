import type { DiffLine } from "../src/types";

export interface Segment {
  start: number; // index into lines[] (inclusive)
  end: number; // index into lines[] (exclusive)
}

/**
 * Split a file's diff lines into snippet-sized segments for a guided walkthrough.
 * Boundaries are hunk headers first, then a max line count within a hunk. The
 * segment count is capped; any overflow is merged into the final segment so every
 * line stays covered.
 */
export function segmentLines(
  lines: DiffLine[],
  maxLines = 18,
  maxSegments = 5,
): Segment[] {
  if (lines.length === 0) return [];

  const segs: Segment[] = [];
  let start = 0;
  let contentCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const isHunk = lines[i].kind === "hunk";
    if (isHunk && i > start) {
      segs.push({ start, end: i });
      start = i;
      contentCount = 0;
    }
    if (!isHunk) {
      contentCount++;
      if (contentCount >= maxLines && i + 1 < lines.length) {
        segs.push({ start, end: i + 1 });
        start = i + 1;
        contentCount = 0;
      }
    }
  }
  if (start < lines.length) segs.push({ start, end: lines.length });

  if (segs.length > maxSegments) {
    const kept = segs.slice(0, maxSegments - 1);
    kept.push({ start: segs[maxSegments - 1].start, end: lines.length });
    return kept;
  }
  return segs;
}

/** Render one segment's code as +/- prefixed text (for the narration prompt). */
export function segmentText(lines: DiffLine[], seg: Segment): string {
  const out: string[] = [];
  for (let i = seg.start; i < seg.end; i++) {
    const l = lines[i];
    const text = l.tokens.map((t) => t.content).join("");
    const mark =
      l.kind === "add" ? "+" : l.kind === "del" ? "-" : l.kind === "hunk" ? "" : " ";
    out.push(mark + text);
  }
  return out.join("\n");
}
