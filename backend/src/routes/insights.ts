import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import {
  generateReadme,
  generateApiDocs,
  reviewCode,
  detectDuplicates,
  generateArchitectureOverview,
  type RagContextChunk,
} from "@codeatlas/ai-service";
import type { DependencyGraph } from "@codeatlas/shared";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

async function loadChunks(repoId: string, userId: string, limit = 80) {
  const repo = await query(
    `SELECT id, name FROM repositories WHERE id = $1 AND user_id = $2`,
    [repoId, userId]
  );
  if (!repo.rows[0]) return null;

  const chunks = await query(
    `SELECT file_path, name, kind, start_line, end_line, content
     FROM code_chunks WHERE repository_id = $1
     ORDER BY file_path, start_line LIMIT $2`,
    [repoId, limit]
  );

  return {
    repo: repo.rows[0] as { id: string; name: string },
    chunks: chunks.rows.map(
      (r): RagContextChunk => ({
        filePath: r.file_path,
        name: r.name,
        kind: r.kind,
        startLine: r.start_line,
        endLine: r.end_line,
        content: r.content,
      })
    ),
  };
}

insightsRouter.get("/:repoId/readme", async (req, res) => {
  const data = await loadChunks(req.params.repoId, req.user!.id);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  const markdown = await generateReadme(data.repo.name, data.chunks);
  res.json({ success: true, data: { markdown } });
});

insightsRouter.get("/:repoId/api-docs", async (req, res) => {
  const data = await loadChunks(req.params.repoId, req.user!.id);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  const markdown = await generateApiDocs(data.chunks);
  res.json({ success: true, data: { markdown } });
});

insightsRouter.get("/:repoId/review", async (req, res) => {
  const data = await loadChunks(req.params.repoId, req.user!.id);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  const markdown = await reviewCode(data.chunks);
  res.json({ success: true, data: { markdown } });
});

insightsRouter.get("/:repoId/duplicates", async (req, res) => {
  const data = await loadChunks(req.params.repoId, req.user!.id, 120);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  const pairs = detectDuplicates(data.chunks);
  res.json({ success: true, data: pairs });
});

insightsRouter.get("/:repoId/architecture", async (req, res) => {
  const data = await loadChunks(req.params.repoId, req.user!.id, 100);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  const files = [...new Set(data.chunks.map((c) => c.filePath))];
  const overview = await generateArchitectureOverview(data.repo.name, files, data.chunks);
  res.json({ success: true, data: overview });
});

insightsRouter.get("/:repoId/dependencies", async (req, res) => {
  const data = await loadChunks(req.params.repoId, req.user!.id, 150);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });

  const files = [...new Set(data.chunks.map((c) => c.filePath))];
  const nodes = files.slice(0, 40).map((f) => ({
    id: f,
    label: f.split(/[\\/]/).pop() || f,
    type: "file" as const,
  }));

  const edges: DependencyGraph["edges"] = [];
  const importRegex =
    /(?:import\s+.+from\s+['"](.+)['"]|require\(['"](.+)['"]\)|from\s+([a-zA-Z0-9_./]+)\s+import)/g;

  for (const chunk of data.chunks) {
    let match: RegExpExecArray | null;
    const content = chunk.content;
    const regex = new RegExp(importRegex.source, "g");
    while ((match = regex.exec(content)) !== null) {
      const raw = match[1] || match[2] || match[3];
      if (!raw || !raw.startsWith(".")) continue;
      const target = nodes.find((n) =>
        n.id.includes(raw.replace(/^\.\//, "").replace(/\.(js|ts|tsx|jsx)$/, ""))
      );
      if (target && target.id !== chunk.filePath) {
        edges.push({
          id: `${chunk.filePath}->${target.id}`,
          source: chunk.filePath,
          target: target.id,
          label: "imports",
        });
      }
    }
  }

  // Ensure a connected visual even with sparse imports
  if (edges.length === 0 && nodes.length > 1) {
    for (let i = 1; i < Math.min(nodes.length, 12); i++) {
      edges.push({
        id: `link-${i}`,
        source: nodes[0].id,
        target: nodes[i].id,
        label: "related",
      });
    }
  }

  const graph: DependencyGraph = { nodes, edges: edges.slice(0, 80) };
  res.json({ success: true, data: graph });
});

insightsRouter.post("/:repoId/explain", async (req, res) => {
  const { target } = req.body as { target?: string };
  const data = await loadChunks(req.params.repoId, req.user!.id, 100);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });

  const needle = (target || "").toLowerCase();
  const matched = needle
    ? data.chunks.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.filePath.toLowerCase().includes(needle)
      )
    : data.chunks.slice(0, 5);

  const { streamRagAnswer } = await import("@codeatlas/ai-service");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  for await (const event of streamRagAnswer(
    `Explain ${target || "the main components"} in detail`,
    matched.slice(0, 8),
    "Focus on purpose, inputs/outputs, and how it fits the architecture."
  )) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
});
