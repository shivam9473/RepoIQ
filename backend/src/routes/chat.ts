import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { embedQuery } from "@codeatlas/embedding-service";
import { searchVectors } from "@codeatlas/vector-service";
import { streamRagAnswer, type RagContextChunk } from "@codeatlas/ai-service";

export const chatRouter = Router();
chatRouter.use(requireAuth);

async function assertRepoAccess(repoId: string, userId: string) {
  const result = await query(
    `SELECT id, name, status FROM repositories WHERE id = $1 AND user_id = $2`,
    [repoId, userId]
  );
  return result.rows[0] as { id: string; name: string; status: string } | undefined;
}

chatRouter.get("/conversations", async (req, res) => {
  const repoId = req.query.repositoryId as string | undefined;
  const params: unknown[] = [req.user!.id];
  let sql = `SELECT * FROM conversations WHERE user_id = $1`;
  if (repoId) {
    params.push(repoId);
    sql += ` AND repository_id = $2`;
  }
  sql += ` ORDER BY updated_at DESC LIMIT 50`;
  const result = await query(sql, params);
  res.json({ success: true, data: result.rows });
});

chatRouter.post("/conversations", async (req, res) => {
  const schema = z.object({
    repositoryId: z.string().uuid(),
    title: z.string().optional(),
  });
  const body = schema.parse(req.body);
  const repo = await assertRepoAccess(body.repositoryId, req.user!.id);
  if (!repo) {
    return res.status(404).json({ success: false, error: "Repository not found" });
  }

  const result = await query(
    `INSERT INTO conversations (user_id, repository_id, title)
     VALUES ($1, $2, $3) RETURNING *`,
    [req.user!.id, body.repositoryId, body.title || `Chat · ${repo.name}`]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

chatRouter.get("/conversations/:id/messages", async (req, res) => {
  const conv = await query(
    `SELECT id FROM conversations WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.id]
  );
  if (!conv.rows[0]) {
    return res.status(404).json({ success: false, error: "Conversation not found" });
  }
  const result = await query(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ success: true, data: result.rows });
});

async function retrieveContext(repositoryId: string, question: string): Promise<RagContextChunk[]> {
  const embedded = await embedQuery(question);
  const hits = await searchVectors(repositoryId, embedded.embedding, 8);

  if (hits.length > 0) {
    return hits.map((h) => ({
      filePath: h.metadata.filePath,
      name: h.metadata.name,
      kind: h.metadata.kind,
      startLine: h.metadata.startLine,
      endLine: h.metadata.endLine,
      content: h.metadata.content,
      score: h.score,
    }));
  }

  // Fallback keyword search in Postgres
  const words = question
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length > 2)
    .slice(0, 5);

  if (words.length === 0) {
    const fallback = await query(
      `SELECT file_path, name, kind, start_line, end_line, content
       FROM code_chunks WHERE repository_id = $1
       ORDER BY created_at DESC LIMIT 6`,
      [repositoryId]
    );
    return fallback.rows.map((r) => ({
      filePath: r.file_path,
      name: r.name,
      kind: r.kind,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content,
    }));
  }

  const likeClauses = words.map((_, i) => `(LOWER(name) LIKE $${i + 2} OR LOWER(content) LIKE $${i + 2} OR LOWER(file_path) LIKE $${i + 2})`);
  const params = [repositoryId, ...words.map((w) => `%${w}%`)];
  const result = await query(
    `SELECT file_path, name, kind, start_line, end_line, content
     FROM code_chunks
     WHERE repository_id = $1 AND (${likeClauses.join(" OR ")})
     LIMIT 8`,
    params
  );

  return result.rows.map((r) => ({
    filePath: r.file_path,
    name: r.name,
    kind: r.kind,
    startLine: r.start_line,
    endLine: r.end_line,
    content: r.content,
  }));
}

chatRouter.post("/ask", async (req, res) => {
  const schema = z.object({
    repositoryId: z.string().uuid(),
    conversationId: z.string().uuid().optional(),
    question: z.string().min(2),
  });
  const body = schema.parse(req.body);

  const repo = await assertRepoAccess(body.repositoryId, req.user!.id);
  if (!repo) {
    return res.status(404).json({ success: false, error: "Repository not found" });
  }

  let conversationId = body.conversationId;
  if (!conversationId) {
    const created = await query(
      `INSERT INTO conversations (user_id, repository_id, title)
       VALUES ($1, $2, $3) RETURNING id`,
      [req.user!.id, body.repositoryId, body.question.slice(0, 80)]
    );
    conversationId = created.rows[0].id;
  }

  await query(
    `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
    [conversationId, body.question]
  );
  await query(
    `INSERT INTO search_history (user_id, repository_id, query) VALUES ($1, $2, $3)`,
    [req.user!.id, body.repositoryId, body.question]
  );

  const chunks = await retrieveContext(body.repositoryId, body.question);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify({ type: "conversation", data: { conversationId } })}\n\n`);

  let full = "";
  let citations: unknown[] = [];

  for await (const event of streamRagAnswer(body.question, chunks)) {
    if (event.type === "token") full += String(event.data);
    if (event.type === "citations") citations = event.data as unknown[];
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  await query(
    `INSERT INTO messages (conversation_id, role, content, citations)
     VALUES ($1, 'assistant', $2, $3::jsonb)`,
    [conversationId, full, JSON.stringify(citations)]
  );
  await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [
    conversationId,
  ]);

  res.write("data: [DONE]\n\n");
  res.end();
});
