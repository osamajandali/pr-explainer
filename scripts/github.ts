import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import type { CommitInfo } from "../src/types";

// ---------- Prep-internal types (raw PR data, before narration/audio) ----------

export interface RawDiffLine {
  kind: "add" | "del" | "ctx";
  content: string;
  oldNo: number | null;
  newNo: number | null;
}

export interface RawHunk {
  header: string;
  lines: RawDiffLine[];
}

export interface RawFile {
  filename: string;
  previousFilename?: string;
  status: string; // added | modified | removed | renamed | changed
  additions: number;
  deletions: number;
  language: string; // Shiki language id
  binary: boolean;
  hunks: RawHunk[];
  truncated: boolean;
  significance: number;
}

export interface PRData {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  author: string;
  baseRef: string;
  headRef: string;
  labels: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: CommitInfo[];
  files: RawFile[];
}

// ---------- Config ----------

const MAX_PATCH_LINES = 400; // truncate a single file's diff beyond this

const NOISE_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /bun\.lockb?$/,
  /composer\.lock$/,
  /Cargo\.lock$/,
  /Gemfile\.lock$/,
  /go\.sum$/,
  /\.min\.(js|css)$/,
  /\.snap$/,
  /\.map$/,
];

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  json: "json",
  md: "markdown",
  html: "html",
  css: "css",
  scss: "scss",
  sql: "sql",
  graphql: "graphql",
  vue: "vue",
  svelte: "svelte",
  toml: "toml",
  dockerfile: "docker",
};

function inferLanguage(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  if (/^dockerfile$/i.test(base)) return "docker";
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  return EXT_TO_LANG[ext] ?? "text";
}

function isNoise(filename: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(filename));
}

/** Higher = more worth spotlighting as its own diff scene. */
function scoreFile(f: {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  binary: boolean;
}): number {
  if (f.binary) return -100;
  const lang = inferLanguage(f.filename);
  let score = f.additions + f.deletions;
  if (isNoise(f.filename)) score -= 1000;
  if (lang === "text" || lang === "json" || lang === "yaml") score -= 20;
  if (/test|spec|__tests__|\.stories\./i.test(f.filename)) score -= 15;
  if (["typescript", "tsx", "javascript", "jsx", "python", "go", "rust", "java"].includes(lang))
    score += 25;
  return score;
}

// ---------- Patch parsing ----------

function parsePatch(patch: string): { hunks: RawHunk[]; truncated: boolean } {
  const hunks: RawHunk[] = [];
  let oldNo = 0;
  let newNo = 0;
  let current: RawHunk | null = null;
  let emitted = 0;
  let truncated = false;

  for (const raw of patch.split("\n")) {
    if (emitted >= MAX_PATCH_LINES) {
      truncated = true;
      break;
    }
    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldNo = m ? Number(m[1]) : oldNo;
      newNo = m ? Number(m[2]) : newNo;
      current = { header: raw, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith("\\")) continue; // "\ No newline at end of file"

    const marker = raw[0];
    const content = raw.slice(1);
    if (marker === "+") {
      current.lines.push({ kind: "add", content, oldNo: null, newNo });
      newNo++;
    } else if (marker === "-") {
      current.lines.push({ kind: "del", content, oldNo, newNo: null });
      oldNo++;
    } else {
      current.lines.push({ kind: "ctx", content, oldNo, newNo });
      oldNo++;
      newNo++;
    }
    emitted++;
  }

  return { hunks, truncated };
}

// ---------- Octokit ----------

const ThrottledOctokit = Octokit.plugin(throttling);

function makeClient(): Octokit {
  // Token is optional: authenticated (required for private repos, 5000 req/hr)
  // when present, otherwise unauthenticated for public repos (60 req/hr).
  const auth = process.env.GITHUB_TOKEN?.trim() || undefined;
  if (!auth) {
    console.warn(
      "No GITHUB_TOKEN set — using unauthenticated access (public repos only, low rate limit).",
    );
  }
  return new ThrottledOctokit({
    auth,
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        console.warn(
          `Rate limit hit for ${options.method} ${options.url}; retrying after ${retryAfter}s`,
        );
        return retryCount < 3;
      },
      onSecondaryRateLimit: (retryAfter, options) => {
        console.warn(
          `Secondary rate limit for ${options.method} ${options.url}; retrying after ${retryAfter}s`,
        );
        return true;
      },
    },
  });
}

// ---------- Fetch ----------

export async function fetchPR(
  owner: string,
  repo: string,
  pull_number: number,
): Promise<PRData> {
  const octokit = makeClient();

  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number });

  const rawCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number,
    per_page: 100,
  });

  const rawFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number,
    per_page: 100,
  });

  const commits: CommitInfo[] = rawCommits.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
    author: c.author?.login ?? c.commit.author?.name ?? "unknown",
    date: c.commit.author?.date ?? "",
  }));

  const files: RawFile[] = rawFiles.map((f) => {
    const binary = !f.patch; // GitHub omits `patch` for binary files
    const { hunks, truncated } = f.patch
      ? parsePatch(f.patch)
      : { hunks: [], truncated: false };
    return {
      filename: f.filename,
      previousFilename: f.previous_filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      language: inferLanguage(f.filename),
      binary,
      hunks,
      truncated,
      significance: scoreFile({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        binary,
      }),
    };
  });

  // Most significant first, so downstream can spotlight the top-N.
  files.sort((a, b) => b.significance - a.significance);

  return {
    owner,
    repo,
    number: pull_number,
    url: pr.html_url,
    title: pr.title,
    body: pr.body ?? "",
    author: pr.user?.login ?? "unknown",
    baseRef: pr.base.ref,
    headRef: pr.head.ref,
    labels: (pr.labels ?? []).map((l) => (typeof l === "string" ? l : l.name ?? "")),
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    commits,
    files,
  };
}

// ---------- Standalone: `tsx scripts/github.ts <PR_URL>` dumps JSON ----------

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parsePrUrl } = await import("./util");
  await import("dotenv/config");
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: tsx scripts/github.ts <github-pr-url>");
    process.exit(1);
  }
  const { owner, repo, number } = parsePrUrl(url);
  const data = await fetchPR(owner, repo, number);
  // Trim hunks in the dump so it stays readable.
  console.log(
    JSON.stringify(
      {
        ...data,
        files: data.files.map((f) => ({
          filename: f.filename,
          status: f.status,
          language: f.language,
          additions: f.additions,
          deletions: f.deletions,
          binary: f.binary,
          truncated: f.truncated,
          significance: f.significance,
          lineCount: f.hunks.reduce((n, h) => n + h.lines.length, 0),
        })),
      },
      null,
      2,
    ),
  );
}
