import { createHighlighter, type Highlighter } from "shiki";
import type { DiffLine, Token } from "../src/types";
import type { RawFile } from "./github";

const THEME = "github-dark";

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>(["text"]);

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [THEME], langs: [] });
  }
  return highlighterPromise;
}

/** Load a language on demand; fall back to plaintext if Shiki lacks it. */
async function ensureLang(hl: Highlighter, lang: string): Promise<string> {
  if (loadedLangs.has(lang)) return lang;
  try {
    await hl.loadLanguage(lang as never);
    loadedLangs.add(lang);
    return lang;
  } catch {
    return "text";
  }
}

function tokenizeLine(hl: Highlighter, content: string, lang: string): Token[] {
  if (content.length === 0) return [{ content: " ", color: "" }];
  try {
    const lines = hl.codeToTokensBase(content, { lang: lang as never, theme: THEME });
    const line = lines[0] ?? [];
    return line.map((t) => ({ content: t.content, color: t.color ?? "" }));
  } catch {
    return [{ content, color: "" }];
  }
}

/** Turn a raw file's hunks into syntax-highlighted DiffLines (tokens per line). */
export async function tokenizeFile(file: RawFile): Promise<DiffLine[]> {
  const hl = await getHighlighter();
  const lang = await ensureLang(hl, file.language);

  const out: DiffLine[] = [];
  for (const hunk of file.hunks) {
    out.push({
      kind: "hunk",
      tokens: [{ content: hunk.header, color: "" }],
      oldNo: null,
      newNo: null,
    });
    for (const l of hunk.lines) {
      out.push({
        kind: l.kind,
        tokens: tokenizeLine(hl, l.content, lang),
        oldNo: l.oldNo,
        newNo: l.newNo,
      });
    }
  }
  return out;
}
