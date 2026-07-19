import express from "express";
import cors from "cors";
import { z } from "zod";
import {
  upsertVectors,
  searchVectors,
  deleteRepositoryVectors,
  type VectorRecord,
} from "./index.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "vector-service" });
});

app.post("/upsert", async (req, res) => {
  try {
    const schema = z.object({
      repositoryId: z.string(),
      records: z.array(z.any()),
    });
    const { repositoryId, records } = schema.parse(req.body);
    const count = await upsertVectors(repositoryId, records as VectorRecord[]);
    res.json({ success: true, data: { upserted: count } });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Upsert failed",
    });
  }
});

app.post("/search", async (req, res) => {
  try {
    const schema = z.object({
      repositoryId: z.string(),
      vector: z.array(z.number()),
      topK: z.number().optional(),
    });
    const { repositoryId, vector, topK } = schema.parse(req.body);
    const hits = await searchVectors(repositoryId, vector, topK ?? 8);
    res.json({ success: true, data: hits });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    });
  }
});

app.delete("/repository/:repositoryId", async (req, res) => {
  try {
    await deleteRepositoryVectors(req.params.repositoryId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    });
  }
});

const port = Number(process.env.VECTOR_SERVICE_PORT || 4002);
if (process.env.RUN_VECTOR_SERVER === "true") {
  app.listen(port, () => {
    console.log(`Vector service listening on :${port}`);
  });
}

export { app };
