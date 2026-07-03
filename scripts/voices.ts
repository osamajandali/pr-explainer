import { GEMINI_VOICES } from "./tts";

// Gemini's prebuilt TTS voices are a fixed set and all free — no account lookup needed.
console.log(`\nGemini TTS voices (${GEMINI_VOICES.length}), all free:\n`);
for (const v of GEMINI_VOICES) console.log(`  • ${v}`);
console.log(
  `\nTo pick one, add it to .env:\n   GEMINI_TTS_VOICE=Kore\n\n` +
    `Preview any voice in Google AI Studio (aistudio.google.com) → "Speech generation".\n`,
);
