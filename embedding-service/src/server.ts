import express from "express";
import cors from "cors";
import { z } from "zod";
import { embedTexts, embedQuery, buildChunkEmbeddingText } from "./index.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "embedding-service" });
});

app.post("/embed", async (req, res) => {
  try {
    const schema = z.object({
      texts: z.array(z.string()).min(1).max(100),
    });
    const { texts } = schema.parse(req.body);
    const results = await embedTexts(texts);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Embedding failed",
    });
  }
});

app.post("/embed/query", async (req, res) => {
  try {
    const schema = z.object({ query: z.string().min(1) });
    const { query } = schema.parse(req.body);
    const result = await embedQuery(query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Query embedding failed",
    });
  }
});

app.post("/embed/chunks", async (req, res) => {
  try {
    const schema = z.object({
      chunks: z.array(
        z.object({
          id: z.string(),
          filePath: z.string(),
          kind: z.string(),
          name: z.string(),
          signature: z.string().nullable(),
          content: z.string(),
          language: z.string(),
        })
      ),
    });
    const { chunks } = schema.parse(req.body);
    const texts = chunks.map(buildChunkEmbeddingText);
    const results = await embedTexts(texts);
    res.json({
      success: true,
      data: chunks.map((chunk, i) => ({
        id: chunk.id,
        ...results[i],
      })),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Chunk embedding failed",
    });
  }
});

const port = Number(process.env.EMBEDDING_SERVICE_PORT || 4001);
if (process.env.RUN_EMBEDDING_SERVER === "true") {
  app.listen(port, () => {
    console.log(`Embedding service listening on :${port}`);
  });
}

export { app };
