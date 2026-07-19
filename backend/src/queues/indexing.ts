import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_NAMES } from "@codeatlas/shared";

let connection: Redis | null = null;
let indexingQueue: Queue | null = null;

export function getRedis() {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export function getIndexingQueue() {
  if (!indexingQueue) {
    indexingQueue = new Queue(QUEUE_NAMES.INDEXING, {
      connection: getRedis(),
    });
  }
  return indexingQueue;
}

export async function enqueueIndexing(repositoryId: string, userId: string) {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const queue = getIndexingQueue();
    await queue.add(
      "index-repository",
      { repositoryId, userId },
      {
        attempts: 2,
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
    return { queued: true as const };
  } catch (error) {
    console.warn("Queue unavailable, will rely on workers or inline fallback", error);
    // Soft signal — workers may still pick up pending status from DB
    void redisUrl;
    return { queued: false as const };
  }
}
