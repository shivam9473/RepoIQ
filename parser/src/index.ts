import path from "node:path";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { CodeChunk, ChunkKind, SupportedLanguage } from "@codeatlas/shared";
import { EXTENSION_LANGUAGE_MAP } from "@codeatlas/shared";

export interface ParseFileInput {
  repositoryId: string;
  filePath: string;
  content: string;
}

interface SymbolMatch {
  kind: ChunkKind;
  name: string;
  signature: string | null;
  startLine: number;
  endLine: number;
  content: string;
  parentName: string | null;
}

const LANGUAGE_PATTERNS: Record<
  string,
  Array<{ kind: ChunkKind; regex: RegExp; nameGroup: number }>
> = {
  javascript: [
    { kind: "class", regex: /^export\s+class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "class", regex: /^class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^export\s+(?:async\s+)?function\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^(?:async\s+)?function\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm, nameGroup: 1 },
    { kind: "function", regex: /^const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm, nameGroup: 1 },
    { kind: "interface", regex: /^export\s+interface\s+(\w+)/gm, nameGroup: 1 },
  ],
  typescript: [
    { kind: "class", regex: /^export\s+class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "class", regex: /^class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "interface", regex: /^export\s+interface\s+(\w+)/gm, nameGroup: 1 },
    { kind: "interface", regex: /^interface\s+(\w+)/gm, nameGroup: 1 },
    { kind: "type", regex: /^export\s+type\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^export\s+(?:async\s+)?function\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^(?:async\s+)?function\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm, nameGroup: 1 },
    { kind: "method", regex: /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm, nameGroup: 1 },
  ],
  python: [
    { kind: "class", regex: /^class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^def\s+(\w+)/gm, nameGroup: 1 },
    { kind: "method", regex: /^\s+def\s+(\w+)/gm, nameGroup: 1 },
  ],
  java: [
    { kind: "class", regex: /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "interface", regex: /(?:public\s+)?interface\s+(\w+)/gm, nameGroup: 1 },
    { kind: "method", regex: /(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/gm, nameGroup: 1 },
  ],
  go: [
    { kind: "function", regex: /^func\s+(\w+)/gm, nameGroup: 1 },
    { kind: "method", regex: /^func\s+\(\w+\s+\*?\w+\)\s+(\w+)/gm, nameGroup: 1 },
    { kind: "type", regex: /^type\s+(\w+)\s+struct/gm, nameGroup: 1 },
    { kind: "interface", regex: /^type\s+(\w+)\s+interface/gm, nameGroup: 1 },
  ],
  cpp: [
    { kind: "class", regex: /^class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^(?:[\w:<>\*&]+\s+)+(\w+)\s*\([^;]*\)\s*\{/gm, nameGroup: 1 },
  ],
  c: [
    { kind: "function", regex: /^(?:[\w\*]+\s+)+(\w+)\s*\([^;]*\)\s*\{/gm, nameGroup: 1 },
  ],
  rust: [
    { kind: "function", regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm, nameGroup: 1 },
    { kind: "class", regex: /^(?:pub\s+)?struct\s+(\w+)/gm, nameGroup: 1 },
    { kind: "interface", regex: /^(?:pub\s+)?trait\s+(\w+)/gm, nameGroup: 1 },
  ],
  ruby: [
    { kind: "class", regex: /^class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^\s*def\s+(\w+)/gm, nameGroup: 1 },
  ],
  php: [
    { kind: "class", regex: /^class\s+(\w+)/gm, nameGroup: 1 },
    { kind: "function", regex: /^(?:public\s+|private\s+|protected\s+)?function\s+(\w+)/gm, nameGroup: 1 },
  ],
};

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function extractBlock(content: string, startIndex: number): { text: string; endIndex: number } {
  const lines = content.slice(startIndex).split("\n");
  const blockLines: string[] = [];
  let braceDepth = 0;
  let indentDepth = -1;
  let started = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    blockLines.push(line);

    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;
    braceDepth += open - close;

    if (open > 0) started = true;

    // Python-style indentation blocks
    if (!started && /^\s*(def|class)\b/.test(line)) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      indentDepth = indent;
    } else if (indentDepth >= 0 && i > 0) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (line.trim() && indent <= indentDepth) {
        blockLines.pop();
        break;
      }
    }

    if (started && braceDepth <= 0) break;
    if (blockLines.length > 250) break;
  }

  const text = blockLines.join("\n");
  return { text, endIndex: startIndex + text.length };
}

function extractSymbols(content: string, language: string): SymbolMatch[] {
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;
  const symbols: SymbolMatch[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match[pattern.nameGroup];
      if (!name || ["if", "for", "while", "switch", "catch", "constructor"].includes(name)) {
        continue;
      }
      const startLine = lineNumberAt(content, match.index);
      const { text, endIndex } = extractBlock(content, match.index);
      const endLine = lineNumberAt(content, endIndex);
      const key = `${pattern.kind}:${name}:${startLine}`;
      if (seen.has(key)) continue;
      seen.add(key);

      symbols.push({
        kind: pattern.kind,
        name,
        signature: match[0].trim().slice(0, 200),
        startLine,
        endLine,
        content: text.slice(0, 8000),
        parentName: null,
      });
    }
  }

  // Fallback: whole file as module chunk if nothing found
  if (symbols.length === 0 && content.trim().length > 0) {
    const lines = content.split("\n");
    symbols.push({
      kind: "module",
      name: "module",
      signature: null,
      startLine: 1,
      endLine: lines.length,
      content: content.slice(0, 8000),
      parentName: null,
    });
  }

  return symbols;
}

export function detectLanguage(filePath: string): SupportedLanguage | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] ?? null;
}

export function parseFile(input: ParseFileInput): CodeChunk[] {
  const language = detectLanguage(input.filePath);
  if (!language) return [];

  const symbols = extractSymbols(input.content, language);
  const fileName = path.basename(input.filePath);

  return symbols.map((symbol) => {
    const hash = createHash("sha256")
      .update(`${input.filePath}:${symbol.name}:${symbol.content}`)
      .digest("hex")
      .slice(0, 16);

    return {
      id: uuidv4(),
      repositoryId: input.repositoryId,
      filePath: input.filePath,
      language,
      kind: symbol.kind === "module" ? "module" : symbol.kind,
      name: symbol.kind === "module" ? fileName : symbol.name,
      signature: symbol.signature,
      content: symbol.content,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      parentName: symbol.parentName,
      hash,
    };
  });
}

export function parseRepositoryFiles(
  repositoryId: string,
  files: Array<{ filePath: string; content: string }>
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  for (const file of files) {
    chunks.push(...parseFile({ repositoryId, ...file }));
  }
  return chunks;
}

export function summarizeChunkStats(chunks: CodeChunk[]) {
  return {
    totalChunks: chunks.length,
    totalFunctions: chunks.filter((c) => c.kind === "function" || c.kind === "method").length,
    totalClasses: chunks.filter((c) => c.kind === "class" || c.kind === "interface").length,
  };
}
