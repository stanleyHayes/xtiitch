import type { RedisOptions } from "bullmq";

export type NotificationTransportName = "disabled" | "log";

export type WorkerConfig = {
  databaseUrl: string;
  redisConnection: RedisOptions;
  queueName: string;
  outboxDrainEnabled: boolean;
  outboxPollIntervalMs: number;
  outboxBatchSize: number;
  outboxLeaseSeconds: number;
  outboxMaxAttempts: number;
  outboxRetryBaseDelayMs: number;
  outboxRetryMaxDelayMs: number;
  notificationTransport: NotificationTransportName;
};

const defaultDatabaseUrl =
  "postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? defaultDatabaseUrl,
    redisConnection: {
      url: env.REDIS_URL ?? "redis://localhost:6379/0",
      maxRetriesPerRequest: null,
    } satisfies RedisOptions,
    queueName: env.WORKER_QUEUE_NAME ?? "xtiitch.outbox",
    outboxDrainEnabled: parseBoolean(env.OUTBOX_DRAIN_ENABLED, true),
    outboxPollIntervalMs: parsePositiveInteger(env.OUTBOX_POLL_INTERVAL_MS, 15_000),
    outboxBatchSize: parsePositiveInteger(env.OUTBOX_BATCH_SIZE, 25),
    outboxLeaseSeconds: parsePositiveInteger(env.OUTBOX_LEASE_SECONDS, 300),
    outboxMaxAttempts: parsePositiveInteger(env.OUTBOX_MAX_ATTEMPTS, 5),
    outboxRetryBaseDelayMs: parsePositiveInteger(env.OUTBOX_RETRY_BASE_DELAY_MS, 60_000),
    outboxRetryMaxDelayMs: parsePositiveInteger(env.OUTBOX_RETRY_MAX_DELAY_MS, 3_600_000),
    notificationTransport: parseTransport(env.NOTIFICATION_TRANSPORT),
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  switch (value.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
      return true;
    case "0":
    case "false":
    case "no":
      return false;
    default:
      throw new Error(`Expected a boolean-like value, got ${value}`);
  }
}

function parseTransport(value: string | undefined): NotificationTransportName {
  if (value === undefined || value.trim() === "") {
    return "log";
  }
  if (value === "disabled" || value === "log") {
    return value;
  }
  throw new Error(`Unsupported NOTIFICATION_TRANSPORT value: ${value}`);
}
