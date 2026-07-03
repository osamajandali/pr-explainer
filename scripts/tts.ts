import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { audioDir, requireEnv, sleep } from "./util";

// Gemini TTS returns raw PCM; we wrap it in a WAV container (Remotion plays WAV).
const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_VOICE = "Kore";
const DEFAULT_RATE = 24000; // Hz, mono, 16-bit — Gemini's TTS output format

// The ~30 prebuilt Gemini voices (all free). See `npm run voices`.
export const GEMINI_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];

export interface TtsResult {
  index: number;
  /** Path relative to public/, e.g. "audio/<jobId>/scene-0.wav". */
  audioSrc: string;
  durationSec: number;
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return client;
}

/** Rough spoken-duration estimate (~2.6 words/sec), used only for the silent fallback. */
export function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, words / 2.6);
}

/** Wrap raw signed 16-bit little-endian mono PCM in a minimal WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bits = 16): Buffer {
  const blockAlign = (channels * bits) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function isRateLimit(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  const msg = (err as Error)?.message ?? "";
  return status === 429 || /RESOURCE_EXHAUSTED|quota|rate/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !isRateLimit(err)) throw err;
      // Free-tier TTS is rate-limited per minute; wait long enough for it to reset.
      const wait = Math.min(60_000, 5_000 * 2 ** (attempt - 1));
      console.warn(`${label}: rate limited, waiting ${wait / 1000}s (attempt ${attempt})`);
      await sleep(wait);
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

/** Synthesize one narration chunk to public/audio/<jobId>/scene-<index>.wav. */
export async function synthesizeScene(
  jobId: string,
  index: number,
  text: string,
): Promise<TtsResult> {
  const voice = process.env.GEMINI_TTS_VOICE?.trim() || DEFAULT_VOICE;
  const model = process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_MODEL;
  const ai = getClient();

  const res = await withRetry(
    () =>
      ai.models.generateContent({
        model,
        contents: text,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      }),
    `TTS scene ${index}`,
  );

  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error(`TTS scene ${index}: no audio returned`);

  const rate = Number(part.inlineData?.mimeType?.match(/rate=(\d+)/)?.[1]) || DEFAULT_RATE;
  const pcm = Buffer.from(b64, "base64");
  const wav = pcmToWav(pcm, rate);
  const filename = path.join(audioDir(jobId), `scene-${index}.wav`);
  fs.writeFileSync(filename, wav);

  const durationSec = pcm.length / 2 / rate; // 16-bit mono
  return { index, audioSrc: `audio/${jobId}/scene-${index}.wav`, durationSec };
}

/** Synthesize a list of narration chunks sequentially (kind to free-tier rate limits). */
export async function synthesizeAll(jobId: string, texts: string[]): Promise<TtsResult[]> {
  const results: TtsResult[] = [];
  for (let i = 0; i < texts.length; i++) {
    const r = await synthesizeScene(jobId, i, texts[i]);
    console.log(`  ♪ scene ${i}: ${r.durationSec.toFixed(1)}s`);
    results.push(r);
    if (i < texts.length - 1) await sleep(1000); // pace requests
  }
  return results;
}

// ---------- Standalone: `tsx scripts/tts.ts "text to speak"` ----------

if (import.meta.url === `file://${process.argv[1]}`) {
  await import("dotenv/config");
  const text = process.argv[2] ?? "Hello from the pull request explainer.";
  const r = await synthesizeScene("smoke-test", 0, text);
  console.log(`Wrote ${r.audioSrc} — ${r.durationSec.toFixed(2)}s`);
}
