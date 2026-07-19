import OpenAI from "openai";

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: "openai" | "voyage" | "local";
}

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function localHashEmbedding(text: string, dims = 384): number[] {
  const vec = new Array(dims).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    const idx = hash % dims;
    vec[idx] += 1;
    vec[(hash * 7) % dims] += 0.5;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function voyageEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY not set");

  const model = process.env.VOYAGE_EMBEDDING_MODEL || "voyage-code-3";
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model,
      input_type: "document",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embedding failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return data.data.map((d) => d.embedding);
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];

  const provider = (process.env.EMBEDDING_PROVIDER || "openai").toLowerCase();

  if (provider === "voyage" && process.env.VOYAGE_API_KEY) {
    const embeddings = await voyageEmbed(texts);
    return embeddings.map((embedding) => ({
      embedding,
      model: process.env.VOYAGE_EMBEDDING_MODEL || "voyage-code-3",
      provider: "voyage" as const,
    }));
  }

  const openai = getOpenAIClient();
  if (openai) {
    const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
    const response = await openai.embeddings.create({
      model,
      input: texts.map((t) => t.slice(0, 8000)),
    });
    return response.data.map((item) => ({
      embedding: item.embedding,
      model,
      provider: "openai" as const,
    }));
  }

  // Deterministic local fallback for offline / demo mode
  return texts.map((text) => ({
    embedding: localHashEmbedding(text),
    model: "local-hash-v1",
    provider: "local" as const,
  }));
}

export async function embedQuery(query: string): Promise<EmbeddingResult> {
  const [result] = await embedTexts([query]);
  return result;
}

export function buildChunkEmbeddingText(chunk: {
  filePath: string;
  kind: string;
  name: string;
  signature: string | null;
  content: string;
  language: string;
}): string {
  return [
    `File: ${chunk.filePath}`,
    `Language: ${chunk.language}`,
    `Kind: ${chunk.kind}`,
    `Name: ${chunk.name}`,
    chunk.signature ? `Signature: ${chunk.signature}` : "",
    "Code:",
    chunk.content,
  ]
    .filter(Boolean)
    .join("\n");
}
