import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const OUT_DIR = path.join(ROOT, "out");

/** Parse a GitHub PR URL into its parts. */
export function parsePrUrl(url: string): {
  owner: string;
  repo: string;
  number: number;
} {
  const m = url
    .trim()
    .match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) {
    throw new Error(
      `Not a valid GitHub PR URL: "${url}"\n` +
        `Expected something like https://github.com/owner/repo/pull/123`,
    );
  }
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

/** Stable, filesystem-safe job id for a PR (used for audio/props folders). */
export function jobIdFor(owner: string, repo: string, number: number): string {
  return `${owner}-${repo}-${number}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Absolute path to the audio directory for a job (created if missing). */
export function audioDir(jobId: string): string {
  const dir = path.join(PUBLIC_DIR, "audio", jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** staticFile()-relative path (POSIX separators) for a scene's audio file. */
export function audioSrc(jobId: string, sceneIndex: number): string {
  return `audio/${jobId}/scene-${sceneIndex}.mp3`;
}

/** Absolute path to the props JSON for a job (parent dir created if missing). */
export function propsPath(jobId: string): string {
  const dir = path.join(PUBLIC_DIR, "props");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${jobId}.json`);
}

/** Read a required environment variable or throw a helpful error. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing ${name}. Add it to your .env file (see .env.example).`,
    );
  }
  return v.trim();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
