import { Pinecone } from "@pinecone-database/pinecone";
import type { CodeChunk, ChunkKind } from "@codeatlas/shared";

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    repositoryId: string;
    filePath: string;
    language: string;
    kind: ChunkKind;
    name: string;
    signature: string;
    startLine: number;
    endLine: number;
    content: string;
    hash: string;
  };
}

export interface SearchHit {
  id: string;
  score: number;
  metadata: VectorRecord["metadata"];
}

type MemoryStore = Map<string, VectorRecord[]>;

const memoryStore: MemoryStore = new Map();

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function getPinecone() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) return null;
  return new Pinecone({ apiKey });
}

export async function upsertVectors(
  repositoryId: string,
  records: VectorRecord[]
): Promise<number> {
  const pinecone = getPinecone();
  const indexName = process.env.PINECONE_INDEX || "codeatlas";

  if (pinecone) {
    const index = pinecone.index(indexName);
    const namespace = index.namespace(repositoryId);
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await namespace.upsert(
        batch.map((r) => ({
          id: r.id,
          values: r.values,
          metadata: {
            ...r.metadata,
            content: r.metadata.content.slice(0, 3500),
          },
        }))
      );
    }
    return records.length;
  }

  memoryStore.set(repositoryId, records);
  return records.length;
}

export async function searchVectors(
  repositoryId: string,
  queryVector: number[],
  topK = 8
): Promise<SearchHit[]> {
  const pinecone = getPinecone();
  const indexName = process.env.PINECONE_INDEX || "codeatlas";

  if (pinecone) {
    const index = pinecone.index(indexName);
    const namespace = index.namespace(repositoryId);
    const result = await namespace.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
    });

    return (result.matches || []).map((m) => ({
      id: m.id,
      score: m.score || 0,
      metadata: m.metadata as VectorRecord["metadata"],
    }));
  }

  const records = memoryStore.get(repositoryId) || [];
  return records
    .map((r) => ({
      id: r.id,
      score: cosineSimilarity(queryVector, r.values),
      metadata: r.metadata,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function deleteRepositoryVectors(repositoryId: string): Promise<void> {
  const pinecone = getPinecone();
  const indexName = process.env.PINECONE_INDEX || "codeatlas";

  if (pinecone) {
    const index = pinecone.index(indexName);
    await index.namespace(repositoryId).deleteAll();
    return;
  }

  memoryStore.delete(repositoryId);
}

export function chunkToVectorRecord(
  chunk: CodeChunk,
  values: number[]
): VectorRecord {
  return {
    id: chunk.id,
    values,
    metadata: {
      repositoryId: chunk.repositoryId,
      filePath: chunk.filePath,
      language: chunk.language,
      kind: chunk.kind,
      name: chunk.name,
      signature: chunk.signature || "",
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      content: chunk.content,
      hash: chunk.hash,
    },
  };
}
