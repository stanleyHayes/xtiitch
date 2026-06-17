import "dotenv/config";

import { Queue, QueueEvents, Worker } from "bullmq";

import { loadConfig } from "./config";
import { drainOutbox, PostgresOutboxStore } from "./outbox";
import { createNotificationSender } from "./senders";

const drainJobName = "drain-notification-outbox";
const drainJobId = "notification-outbox-drain";

const config = loadConfig();
const store = new PostgresOutboxStore(config.databaseUrl);
const sender = createNotificationSender({
  transport: config.notificationTransport,
  http: config.notificationHttp,
});
const queue = new Queue(config.queueName, { connection: config.redisConnection });

const worker = new Worker(
  config.queueName,
  async (job) => {
    if (job.name !== drainJobName) {
      console.log({ jobId: job.id, jobName: job.name }, "ignored unsupported worker job");
      return;
    }

    const summary = await drainOutbox({
      store,
      sender,
      batchSize: config.outboxBatchSize,
      leaseSeconds: config.outboxLeaseSeconds,
      retryPolicy: {
        maxAttempts: config.outboxMaxAttempts,
        baseDelayMs: config.outboxRetryBaseDelayMs,
        maxDelayMs: config.outboxRetryMaxDelayMs,
      },
    });
    console.log({ jobId: job.id, ...summary }, "notification outbox drained");
  },
  { connection: config.redisConnection, concurrency: 1 },
);

const events = new QueueEvents(config.queueName, { connection: config.redisConnection });

events.on("failed", ({ jobId, failedReason }) => {
  console.error({ jobId, failedReason }, "job failed");
});

if (config.outboxDrainEnabled) {
  await queue.add(
    drainJobName,
    {},
    {
      jobId: drainJobId,
      repeat: { every: config.outboxPollIntervalMs },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
  await queue.add(drainJobName, {}, { jobId: `${drainJobId}:startup`, removeOnComplete: true, removeOnFail: 50 });
  console.log(
    {
      queueName: config.queueName,
      pollIntervalMs: config.outboxPollIntervalMs,
      batchSize: config.outboxBatchSize,
      transport: config.notificationTransport,
    },
    "notification outbox worker scheduled",
  );
}

let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  await events.close();
  await worker.close();
  await queue.close();
  await store.close();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
