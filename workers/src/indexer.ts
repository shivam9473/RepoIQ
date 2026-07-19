import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { simpleGit } from "simple-git";
import { parseRepositoryFiles, summarizeChunkStats, detectLanguage } from "@codeatlas/parser";
import { embedTexts, buildChunkEmbeddingText } from "@codeatlas/embedding-service";
import { upsertVectors, chunkToVectorRecord, deleteRepositoryVectors } from "@codeatlas/vector-service";
import { EXTENSION_LANGUAGE_MAP } from "@codeatlas/shared";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://codeatlas:codeatlas@localhost:5432/codeatlas",
});

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".turbo",
]);

async function updateStatus(
  repositoryId: string,
  status: string,
  progress: number,
  statusMessage: string,
  extra: Record<string, unknown> = {}
) {
  const fields = [
    "status = $2",
    "progress = $3",
    "status_message = $4",
    "updated_at = NOW()",
  ];
  const values: unknown[] = [repositoryId, status, progress, statusMessage];
  let idx = 5;

  for (const [key, value] of Object.entries(extra)) {
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  await pool.query(
    `UPDATE repositories SET ${fields.join(", ")} WHERE id = $1`,
    values
  );
}

async function walkFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, base)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXTENSION_LANGUAGE_MAP[ext]) {
        files.push(path.relative(base, full));
      }
    }
  }
  return files;
}

async function getAccessToken(userId: string) {
  const result = await pool.query<{ access_token: string }>(
    `SELECT access_token FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.access_token || "";
}

export async function indexRepository(repositoryId: string, userId: string) {
  const repoRes = await pool.query(
    `SELECT * FROM repositories WHERE id = $1 AND user_id = $2`,
    [repositoryId, userId]
  );
  const repo = repoRes.rows[0];
  if (!repo) throw new Error("Repository not found");

  const reposRoot = path.resolve(process.env.REPOS_PATH || "./repos");
  const targetDir = path.join(reposRoot, repositoryId);

  try {
    await updateStatus(repositoryId, "cloning", 5, "Cloning repository...");
    await fs.mkdir(reposRoot, { recursive: true });
    await fs.rm(targetDir, { recursive: true, force: true });

    const token = await getAccessToken(userId);
    let cloneUrl = repo.clone_url as string;
    if (token && token !== "demo-token" && cloneUrl.startsWith("https://")) {
      cloneUrl = cloneUrl.replace("https://", `https://x-access-token:${token}@`);
    }

    const git = simpleGit();
    try {
      await git.clone(cloneUrl, targetDir, [
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        repo.default_branch || "main",
      ]);
    } catch {
      // Fallback: shallow clone without branch pin
      await fs.rm(targetDir, { recursive: true, force: true });
      await git.clone(cloneUrl, targetDir, ["--depth", "1"]);
    }

    await updateStatus(repositoryId, "parsing", 25, "Parsing source files with AST chunker...");
    let relativeFiles = await walkFiles(targetDir);

    // Cap for very large repos during indexing
    relativeFiles = relativeFiles.slice(0, 800);

    const fileContents: Array<{ filePath: string; content: string }> = [];
    for (const rel of relativeFiles) {
      try {
        const abs = path.join(targetDir, rel);
        const stat = await fs.stat(abs);
        if (stat.size > 250_000) continue;
        const content = await fs.readFile(abs, "utf8");
        if (!detectLanguage(rel)) continue;
        fileContents.push({ filePath: rel.replace(/\\/g, "/"), content });
      } catch {
        // skip unreadable files
      }
    }

    const chunks = parseRepositoryFiles(repositoryId, fileContents);
    const stats = summarizeChunkStats(chunks);

    await pool.query(`DELETE FROM code_chunks WHERE repository_id = $1`, [repositoryId]);
    for (const chunk of chunks) {
      await pool.query(
        `INSERT INTO code_chunks (
          id, repository_id, file_path, language, kind, name, signature,
          content, start_line, end_line, parent_name, hash
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          chunk.id,
          chunk.repositoryId,
          chunk.filePath,
          chunk.language,
          chunk.kind,
          chunk.name,
          chunk.signature,
          chunk.content,
          chunk.startLine,
          chunk.endLine,
          chunk.parentName,
          chunk.hash,
        ]
      );
    }

    await updateStatus(repositoryId, "embedding", 55, "Generating embeddings...", {
      total_files: fileContents.length,
      total_chunks: stats.totalChunks,
      total_functions: stats.totalFunctions,
      total_classes: stats.totalClasses,
    });

    await deleteRepositoryVectors(repositoryId).catch(() => undefined);

    const batchSize = 32;
    let embeddedCount = 0;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(buildChunkEmbeddingText);
      const embeddings = await embedTexts(texts);
      const records = batch.map((chunk, idx) =>
        chunkToVectorRecord(chunk, embeddings[idx].embedding)
      );
      await upsertVectors(repositoryId, records);
      embeddedCount += records.length;
      const progress = 55 + Math.floor((embeddedCount / Math.max(chunks.length, 1)) * 35);
      await updateStatus(
        repositoryId,
        "embedding",
        Math.min(progress, 90),
        `Embedded ${embeddedCount}/${chunks.length} chunks...`
      );
    }

    await updateStatus(repositoryId, "storing", 95, "Finalizing index...");
    await updateStatus(repositoryId, "ready", 100, "Repository indexed successfully", {
      total_files: fileContents.length,
      total_chunks: stats.totalChunks,
      total_embeddings: embeddedCount,
      total_functions: stats.totalFunctions,
      total_classes: stats.totalClasses,
      last_indexed_at: new Date(),
      error_message: null,
    });

    console.log(
      `Indexed ${repo.full_name}: ${fileContents.length} files, ${stats.totalChunks} chunks`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Indexing failed";
    console.error(`Indexing failed for ${repositoryId}`, error);
    await updateStatus(repositoryId, "failed", 0, "Indexing failed", {
      error_message: message,
    });
    throw error;
  }
}
