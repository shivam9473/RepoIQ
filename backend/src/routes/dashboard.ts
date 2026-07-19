import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req, res) => {
  const userId = req.user!.id;

  const stats = await query<{
    repositories: string;
    ready: string;
    indexing: string;
    total_files: string;
    total_functions: string;
    total_classes: string;
    total_embeddings: string;
  }>(
    `SELECT
      COUNT(*)::text AS repositories,
      COUNT(*) FILTER (WHERE status = 'ready')::text AS ready,
      COUNT(*) FILTER (WHERE status NOT IN ('ready', 'failed'))::text AS indexing,
      COALESCE(SUM(total_files), 0)::text AS total_files,
      COALESCE(SUM(total_functions), 0)::text AS total_functions,
      COALESCE(SUM(total_classes), 0)::text AS total_classes,
      COALESCE(SUM(total_embeddings), 0)::text AS total_embeddings
     FROM repositories WHERE user_id = $1`,
    [userId]
  );

  const recentChats = await query(
    `SELECT id, user_id, repository_id, title, created_at, updated_at
     FROM conversations WHERE user_id = $1
     ORDER BY updated_at DESC LIMIT 8`,
    [userId]
  );

  const searchHistory = await query(
    `SELECT id, user_id, repository_id, query, created_at
     FROM search_history WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 12`,
    [userId]
  );

  const row = stats.rows[0];
  res.json({
    success: true,
    data: {
      repositories: Number(row.repositories),
      readyRepos: Number(row.ready),
      indexingRepos: Number(row.indexing),
      totalFiles: Number(row.total_files),
      totalFunctions: Number(row.total_functions),
      totalClasses: Number(row.total_classes),
      totalEmbeddings: Number(row.total_embeddings),
      recentChats: recentChats.rows,
      searchHistory: searchHistory.rows,
    },
  });
});
