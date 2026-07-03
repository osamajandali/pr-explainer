# PR Explainer

Turn a GitHub Pull Request into a narrated, animated walkthrough video.

Point it at a PR and it fetches the metadata, commits, and diffs, has **Google Gemini**
write a spoken explanation of what changed and why, voices it with **Gemini TTS**, and
animates everything with **Remotion** — title card, overview, commit timeline,
syntax-highlighted diffs, stats, and an outro. One command → one `.mp4`. Everything runs
on Google's free API tier — just one key.

**Guided code reading.** Each spotlighted file's diff is split into snippet-sized
segments, and a "camera" walks through them **one snippet at a time** — it holds on the
current lines (highlighted, with the rest dimmed for context) while their narration plays,
then smoothly eases down to the next snippet. A reviewer can follow the whole change end to
end instead of hearing a vague summary. (Pan/cross-fade speed: the `TRANSITION` constant in
`src/components/DiffView.tsx`.)

## How it works

Remotion renders deterministic frames, so it can't wait on audio at render time.
The tool runs in two phases:

1. **Prep** (`scripts/`) — fetch the PR → build a narration script → generate one audio
   clip per scene with Gemini TTS (raw PCM → WAV, so its exact duration is known) → write
   `public/props/<jobId>.json`.
2. **Render** (`src/`) — Remotion reads that props file, sums the per-scene durations to
   set the video length, and plays each scene for exactly its narration's length.

## Setup

```bash
npm install
cp .env.example .env   # already created for you — fill in the values
```

Fill in `.env`:

| Variable | Required | Notes |
|---|---|---|
| `GITHUB_TOKEN` | for private repos | Fine-grained PAT: **Contents: Read** + **Pull requests: Read**. Optional for public repos. |
| `GEMINI_API_KEY` | for narration + voice | Free key from https://aistudio.google.com/apikey. Writes the walkthrough AND voices it (Gemini TTS). Without it you still get a **silent** video with a factual template and estimated timing. |
| `GEMINI_TTS_VOICE` | optional | Defaults to `Kore`. Run `npm run voices` for the full list of ~30 free voices. |
| `GEMINI_TTS_MODEL` | optional | Defaults to `gemini-3.1-flash-tts-preview`. |

## Usage

```bash
# Everything → finished MP4 in out/
npm run make -- https://github.com/owner/repo/pull/123

# Just prep the data (no render)
npm run generate -- https://github.com/owner/repo/pull/123

# Preview / scrub in Remotion Studio, then load public/props/<jobId>.json
npm run studio
```

## Project layout

```
scripts/
  generate.ts        orchestrator: PR URL → props JSON (+ audio) → render
  github.ts          Octokit fetch, patch parsing, file ranking
  script-gemini.ts   Gemini narration (with a mechanical fallback)
  tts.ts             Gemini TTS → WAV + exact durations
  highlight.ts       Shiki syntax highlighting (pre-tokenized in prep)
src/
  Root.tsx           <Composition> + calculateMetadata (sums scene frames)
  PRVideo.tsx        <Series> of scenes, each = audio + animated visual
  scenes/            TitleCard, Overview, CommitTimeline, DiffScene, StatsSummary, Outro
```

## Notes

- The most significant ~6 files are spotlighted, each split into up to 5 narrated
  snippets (capped at 16 snippets total across the video to keep length and TTS cost
  sane). Tune `MAX_FILES`, `MAX_SEGMENTS_PER_FILE`, `MAX_SEGMENT_LINES`, and
  `MAX_TOTAL_SEGMENTS` at the top of `scripts/generate.ts`.
- Large diffs are truncated; the rest of the change is summarized in the stats scene.
- Binary and lockfile changes are counted but not shown as diffs.
- Generated `public/audio/`, `public/props/`, and `out/` are gitignored.
- Gemini's free TTS tier is rate-limited per minute, so audio is generated sequentially and
  auto-retries with backoff on 429s — a many-snippet PR may take a few minutes at the audio step.
