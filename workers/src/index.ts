import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_NAMES, type IndexingJobPayload } from "@codeatlas/shared";
import { indexRepository } from "./indexer.js";
import { pollPendingRepositories } from "./poller.js";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker<IndexingJobPayload>(
  QUEUE_NAMES.INDEXING,
  async (job) => {
    console.log(`Indexing job ${job.id} for repo ${job.data.repositoryId}`);
    await indexRepository(job.data.repositoryId, job.data.userId);
  },
  { connection, concurrency: 1 }
);

worker.on("completed", (job) => {
  console.log(`Indexing completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`Indexing failed: ${job?.id}`, err);
});

console.log("CodeAtlas workers started — listening for indexing jobs");

// Fallback poller if queue events are missed / Redis briefly unavailable
setInterval(() => {
  pollPendingRepositories().catch((err) =>
    console.warn("Poller error", err instanceof Error ? err.message : err)
  );
}, 15000);

pollPendingRepositories().catch(() => undefined);
