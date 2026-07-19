import express from "express";
import cors from "cors";
import { z } from "zod";
import {
  streamRagAnswer,
  generateReadme,
  generateApiDocs,
  reviewCode,
  detectDuplicates,
  generateArchitectureOverview,
  type RagContextChunk,
} from "./index.js";

const chunkSchema = z.object({
  filePath: z.string(),
  name: z.string(),
  kind: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  content: z.string(),
  score: z.number().optional(),
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-service" });
});

app.post("/rag/stream", async (req, res) => {
  try {
    const schema = z.object({
      question: z.string().min(1),
      chunks: z.array(chunkSchema),
      systemExtra: z.string().optional(),
    });
    const { question, chunks, systemExtra } = schema.parse(req.body);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const event of streamRagAnswer(question, chunks as RagContextChunk[], systemExtra)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "RAG stream failed",
    });
  }
});

app.post("/docs/readme", async (req, res) => {
  try {
    const schema = z.object({
      repoName: z.string(),
      chunks: z.array(chunkSchema),
    });
    const body = schema.parse(req.body);
    const markdown = await generateReadme(body.repoName, body.chunks as RagContextChunk[]);
    res.json({ success: true, data: { markdown } });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "README generation failed",
    });
  }
});

app.post("/docs/api", async (req, res) => {
  try {
    const schema = z.object({ chunks: z.array(chunkSchema) });
    const body = schema.parse(req.body);
    const markdown = await generateApiDocs(body.chunks as RagContextChunk[]);
    res.json({ success: true, data: { markdown } });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "API docs generation failed",
    });
  }
});

app.post("/review", async (req, res) => {
  try {
    const schema = z.object({ chunks: z.array(chunkSchema) });
    const body = schema.parse(req.body);
    const markdown = await reviewCode(body.chunks as RagContextChunk[]);
    res.json({ success: true, data: { markdown } });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Review failed",
    });
  }
});

app.post("/duplicates", (req, res) => {
  try {
    const schema = z.object({ chunks: z.array(chunkSchema) });
    const body = schema.parse(req.body);
    const pairs = detectDuplicates(body.chunks as RagContextChunk[]);
    res.json({ success: true, data: pairs });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Duplicate detection failed",
    });
  }
});

app.post("/architecture", async (req, res) => {
  try {
    const schema = z.object({
      repoName: z.string(),
      files: z.array(z.string()),
      chunks: z.array(chunkSchema),
    });
    const body = schema.parse(req.body);
    const overview = await generateArchitectureOverview(
      body.repoName,
      body.files,
      body.chunks as RagContextChunk[]
    );
    res.json({ success: true, data: overview });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Architecture overview failed",
    });
  }
});

const port = Number(process.env.AI_SERVICE_PORT || 4003);
if (process.env.RUN_AI_SERVER === "true") {
  app.listen(port, () => {
    console.log(`AI service listening on :${port}`);
  });
}

export { app };
