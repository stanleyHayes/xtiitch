import "dotenv/config";

import { Queue, QueueEvents, Worker } from "bullmq";

import {
  PostgresSubscriptionBillingSweepStore,
  runSubscriptionBillingSweep,
} from "./billing";
import { loadConfig } from "./config";
import { InternalApiClient, runInternalSweep } from "./internal";
import { drainOutbox, PostgresOutboxStore } from "./outbox";
import { createNotificationSender } from "./senders";

const drainJobName = "drain-notification-outbox";
const drainJobId = "notification-outbox-drain";
const billingSweepJobName = "run-subscription-billing-sweep";
const billingSweepJobId = "subscription-billing-sweep";

const config = loadConfig();

// Internal scheduler sweeps: the worker fires the API's /v1/internal/*
// endpoints on a timer; the sweep logic lives API-side (the same service
// methods the admin console triggers). Paths are relative to /v1/internal.
const internalSweeps = [
  // Daily: card auto-billing for due subscriptions (§13.3).
  {
    name: "run-recurring-charges-sweep",
    path: "/sweeps/recurring-charges",
    intervalMs: config.recurringChargesSweepIntervalMs,
  },
  // Daily: 15/7/3/0-day renewal reminders by SMS + email (§13.3).
  {
    name: "run-renewal-reminders-sweep",
    path: "/sweeps/renewal-reminders",
    intervalMs: config.renewalRemindersSweepIntervalMs,
  },
  // Daily: generate + email due scheduled reports (§14.1; cadence math DB-side).
  {
    name: "run-scheduled-reports",
    path: "/reports/run-scheduled",
    intervalMs: config.scheduledReportsIntervalMs,
  },
  // Every 15 min: keep Money Desk payout reflection near-real-time (§3.3/§4.10).
  {
    name: "run-settlement-sync",
    path: "/settlements/sync",
    intervalMs: config.settlementSyncIntervalMs,
  },
] as const;

const store = new PostgresOutboxStore(config.databaseUrl);
const billingStore = new PostgresSubscriptionBillingSweepStore(
  config.databaseUrl,
);
const sender = createNotificationSender({
  transport: config.notificationTransport,
  http: config.notificationHttp,
  whatsappCloud: config.whatsappCloud,
  arkesel: config.arkesel,
});
const internalClient = config.internalApi
  ? new InternalApiClient(config.internalApi)
  : undefined;
const queue = new Queue(config.queueName, {
  connection: config.redisConnection,
});

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
        console.log(
          { jobId: job.id, ...summary },
          "notification outbox drained",
        );
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
      case "run-recurring-charges-sweep":
      case "run-renewal-reminders-sweep":
      case "run-scheduled-reports":
      case "run-settlement-sync": {
        const sweep = internalSweeps.find((entry) => entry.name === job.name);
        if (!internalClient || !sweep) {
          console.log(
            { jobId: job.id, jobName: job.name },
            "skipped internal sweep: XTIITCH_INTERNAL_TOKEN not configured",
          );
          return;
        }
        // Failures are logged, not thrown: a flapping API must not retry-storm
        // the queue — the next scheduled run fires the sweep again.
        const result = await runInternalSweep({
          client: internalClient,
          path: sweep.path,
        });
        if (result.ok) {
          console.log(
            { jobId: job.id, path: sweep.path, status: result.status },
            "internal sweep triggered",
          );
        } else {
          console.error(
            {
              jobId: job.id,
              path: sweep.path,
              status: result.status,
              error: result.error,
            },
            "internal sweep trigger failed",
          );
        }
        return;
      }
      default:
        console.log(
          { jobId: job.id, jobName: job.name },
          "ignored unsupported worker job",
        );
    }
  },
  { connection: config.redisConnection, concurrency: 1 },
);

const events = new QueueEvents(config.queueName, {
  connection: config.redisConnection,
});

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
  await queue.add(
    drainJobName,
    {},
    {
      jobId: `${drainJobId}-startup`,
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
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
      jobId: `${billingSweepJobId}-startup`,
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

if (internalClient) {
  for (const sweep of internalSweeps) {
    await queue.add(
      sweep.name,
      {},
      {
        jobId: sweep.name,
        repeat: { every: sweep.intervalMs },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
    await queue.add(
      sweep.name,
      {},
      {
        jobId: `${sweep.name}-startup`,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }
  console.log(
    {
      queueName: config.queueName,
      sweeps: internalSweeps.map((sweep) => ({
        name: sweep.name,
        intervalMs: sweep.intervalMs,
      })),
      apiUrl: config.internalApi?.apiUrl,
    },
    "internal sweep workers scheduled",
  );
} else {
  console.log(
    "XTIITCH_INTERNAL_TOKEN not set; internal sweep jobs disabled (recurring charges, renewal reminders, scheduled reports, settlement sync)",
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
