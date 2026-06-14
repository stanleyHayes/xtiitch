import "dotenv/config";

import { QueueEvents, Worker, type RedisOptions } from "bullmq";

const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379/0",
  maxRetriesPerRequest: null,
} satisfies RedisOptions;

const queueName = process.env.WORKER_QUEUE_NAME ?? "xtiitch.default";

const worker = new Worker(
  queueName,
  async (job) => {
    console.log({ jobId: job.id, jobName: job.name }, "received job");
  },
  { connection },
);

const events = new QueueEvents(queueName, { connection });

events.on("failed", ({ jobId, failedReason }) => {
  console.error({ jobId, failedReason }, "job failed");
});

const shutdown = async () => {
  await events.close();
  await worker.close();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
