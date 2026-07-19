import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { enqueueIndexing } from "../queues/indexing.js";
import { mapRepo } from "../utils/mappers.js";
import { deleteRepositoryVectors } from "@codeatlas/vector-service";

export const reposRouter = Router();
reposRouter.use(requireAuth);

async function getUserToken(userId: string) {
  const result = await query<{ access_token: string }>(
    `SELECT access_token FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.access_token || "";
}

reposRouter.get("/", async (req, res) => {
  const result = await query(
    `SELECT * FROM repositories WHERE user_id = $1 ORDER BY updated_at DESC`,
    [req.user!.id]
  );
  res.json({ success: true, data: result.rows.map((r) => mapRepo(r as never)) });
});

reposRouter.get("/github/list", async (req, res) => {
  const token = await getUserToken(req.user!.id);
  if (!token || token === "demo-token") {
    return res.json({
      success: true,
      data: [
        {
          id: 1,
          full_name: "shivam9473/RepoIQ",
          name: "RepoIQ",
          owner: { login: "shivam9473" },
          description: "CodeAtlas AI — Code Intelligence Platform",
          private: false,
          language: "TypeScript",
          default_branch: "main",
          clone_url: "https://github.com/shivam9473/RepoIQ.git",
          html_url: "https://github.com/shivam9473/RepoIQ",
        },
        {
          id: 2,
          full_name: "vercel/next.js",
          name: "next.js",
          owner: { login: "vercel" },
          description: "The React Framework",
          private: false,
          language: "JavaScript",
          default_branch: "canary",
          clone_url: "https://github.com/vercel/next.js.git",
          html_url: "https://github.com/vercel/next.js",
        },
      ],
      demo: true,
    });
  }

  const ghRes = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!ghRes.ok) {
    return res.status(502).json({ success: false, error: "GitHub API error" });
  }
  const repos = await ghRes.json();
  res.json({ success: true, data: repos });
});

reposRouter.post("/import", async (req, res) => {
  const schema = z.object({
    fullName: z.string().optional(),
    cloneUrl: z.string().url().optional(),
    githubId: z.number().optional(),
    name: z.string().optional(),
    owner: z.string().optional(),
    description: z.string().nullable().optional(),
    defaultBranch: z.string().optional(),
    isPrivate: z.boolean().optional(),
    language: z.string().nullable().optional(),
    htmlUrl: z.string().optional(),
  });

  const body = schema.parse(req.body);

  let meta = body;
  if (body.fullName && !body.cloneUrl) {
    const [owner, name] = body.fullName.split("/");
    meta = {
      ...body,
      owner,
      name,
      cloneUrl: `https://github.com/${body.fullName}.git`,
      htmlUrl: `https://github.com/${body.fullName}`,
      githubId: body.githubId ?? Date.now() % 1_000_000_000,
      defaultBranch: body.defaultBranch || "main",
      isPrivate: body.isPrivate ?? false,
    };
  }

  if (!meta.cloneUrl || !meta.name || !meta.owner) {
    return res.status(400).json({
      success: false,
      error: "Provide fullName or cloneUrl with owner/name",
    });
  }

  const fullName = meta.fullName || `${meta.owner}/${meta.name}`;
  const githubId = meta.githubId ?? Date.now() % 1_000_000_000;

  const inserted = await query(
    `INSERT INTO repositories (
      user_id, github_id, full_name, name, owner, description, default_branch,
      is_private, language, clone_url, html_url, status, progress, status_message
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',0,'Queued for indexing')
    ON CONFLICT (user_id, github_id) DO UPDATE SET
      description = EXCLUDED.description,
      status = 'pending',
      progress = 0,
      status_message = 'Re-queued for indexing',
      error_message = NULL,
      updated_at = NOW()
    RETURNING *`,
    [
      req.user!.id,
      githubId,
      fullName,
      meta.name,
      meta.owner,
      meta.description ?? null,
      meta.defaultBranch || "main",
      meta.isPrivate ?? false,
      meta.language ?? null,
      meta.cloneUrl,
      meta.htmlUrl || `https://github.com/${fullName}`,
    ]
  );

  const repo = mapRepo(inserted.rows[0] as never);
  await enqueueIndexing(repo.id, req.user!.id);

  res.status(201).json({ success: true, data: repo });
});

reposRouter.get("/:id", async (req, res) => {
  const result = await query(
    `SELECT * FROM repositories WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ success: false, error: "Repository not found" });
  }
  res.json({ success: true, data: mapRepo(result.rows[0] as never) });
});

reposRouter.post("/:id/reindex", async (req, res) => {
  const result = await query(
    `UPDATE repositories
     SET status = 'pending', progress = 0, status_message = 'Re-queued', error_message = NULL, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [req.params.id, req.user!.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ success: false, error: "Repository not found" });
  }
  await enqueueIndexing(req.params.id, req.user!.id);
  res.json({ success: true, data: mapRepo(result.rows[0] as never) });
});

reposRouter.get("/:id/chunks", async (req, res) => {
  const repo = await query(
    `SELECT id FROM repositories WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.id]
  );
  if (!repo.rows[0]) {
    return res.status(404).json({ success: false, error: "Repository not found" });
  }

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const result = await query(
    `SELECT id, repository_id, file_path, language, kind, name, signature,
            start_line, end_line, parent_name, hash,
            LEFT(content, 500) AS content_preview
     FROM code_chunks
     WHERE repository_id = $1
     ORDER BY file_path, start_line
     LIMIT $2`,
    [req.params.id, limit]
  );
  res.json({ success: true, data: result.rows });
});

reposRouter.get("/:id/file", async (req, res) => {
  const filePath = String(req.query.path || "");
  if (!filePath) {
    return res.status(400).json({ success: false, error: "path query required" });
  }

  const repo = await query(
    `SELECT id FROM repositories WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.id]
  );
  if (!repo.rows[0]) {
    return res.status(404).json({ success: false, error: "Repository not found" });
  }

  const result = await query<{ content: string; language: string; name: string }>(
    `SELECT content, language, name FROM code_chunks
     WHERE repository_id = $1 AND file_path = $2
     ORDER BY start_line ASC`,
    [req.params.id, filePath]
  );

  res.json({
    success: true,
    data: {
      filePath,
      chunks: result.rows,
    },
  });
});

reposRouter.delete("/:id", async (req, res) => {
  const result = await query(
    `DELETE FROM repositories WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user!.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ success: false, error: "Repository not found" });
  }
  try {
    await deleteRepositoryVectors(req.params.id);
  } catch (error) {
    console.warn("Failed to delete vectors", error);
  }
  res.json({ success: true });
});
