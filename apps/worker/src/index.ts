import "dotenv/config";

import { Queue, QueueEvents, Worker } from "bullmq";

import { PostgresSubscriptionBillingSweepStore, runSubscriptionBillingSweep } from "./billing";
import { loadConfig } from "./config";
import { drainOutbox, PostgresOutboxStore } from "./outbox";
import { createNotificationSender } from "./senders";

const drainJobName = "drain-notification-outbox";
const drainJobId = "notification-outbox-drain";
const billingSweepJobName = "run-subscription-billing-sweep";
const billingSweepJobId = "subscription-billing-sweep";

const config = loadConfig();
const store = new PostgresOutboxStore(config.databaseUrl);
const billingStore = new PostgresSubscriptionBillingSweepStore(config.databaseUrl);
const sender = createNotificationSender({
  transport: config.notificationTransport,
  http: config.notificationHttp,
});
const queue = new Queue(config.queueName, { connection: config.redisConnection });

const worker = new Worker(
  config.queueName,
  async (job) => {
    switch (job.name) {
      case drainJobName: {
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
        return;
      }
      case billingSweepJobName: {
        const summary = await runSubscriptionBillingSweep({
          store: billingStore,
          reason: "Scheduled worker billing sweep.",
        });
        console.log(
          {
            jobId: job.id,
            overdueInvoicesFailed: summary.overdueInvoicesFailed,
            subscriptionsCanceled: summary.subscriptionsCanceled,
            businessesTouched: summary.businessesTouched,
            ranAt: summary.ranAt.toISOString(),
          },
          "subscription billing sweep completed",
        );
        return;
      }
      default:
        console.log({ jobId: job.id, jobName: job.name }, "ignored unsupported worker job");
    }
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

if (config.subscriptionBillingSweepEnabled) {
  await queue.add(
    billingSweepJobName,
    {},
    {
      jobId: billingSweepJobId,
      repeat: { every: config.subscriptionBillingSweepIntervalMs },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
  await queue.add(
    billingSweepJobName,
    {},
    {
      jobId: `${billingSweepJobId}:startup`,
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
  console.log(
    {
      queueName: config.queueName,
      sweepIntervalMs: config.subscriptionBillingSweepIntervalMs,
    },
    "subscription billing sweep worker scheduled",
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
  await billingStore.close();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
