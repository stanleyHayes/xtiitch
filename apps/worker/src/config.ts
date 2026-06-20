import type { RedisOptions } from "bullmq";

export type NotificationTransportName =
  | "disabled"
  | "log"
  | "http"
  | "whatsapp_cloud";

export type NotificationHttpConfig = {
  url: string;
  authHeader: string;
  authValue: string;
  from: string;
  timeoutMs: number;
};

// WhatsApp Business Cloud API (Meta Graph API). Ghana runs on WhatsApp, so this
// is the primary delivery channel for customer order updates.
export type WhatsAppCloudConfig = {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  timeoutMs: number;
};

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
  subscriptionBillingSweepEnabled: boolean;
  subscriptionBillingSweepIntervalMs: number;
  notificationTransport: NotificationTransportName;
  notificationHttp?: NotificationHttpConfig;
  whatsappCloud?: WhatsAppCloudConfig;
};

const defaultDatabaseUrl =
  "postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const notificationTransport = parseTransport(env.NOTIFICATION_TRANSPORT);
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
    subscriptionBillingSweepEnabled: parseBoolean(
      env.SUBSCRIPTION_BILLING_SWEEP_ENABLED,
      true,
    ),
    subscriptionBillingSweepIntervalMs: parsePositiveInteger(
      env.SUBSCRIPTION_BILLING_SWEEP_INTERVAL_MS,
      3_600_000,
    ),
    notificationTransport,
    notificationHttp: parseNotificationHttpConfig(notificationTransport, env),
    whatsappCloud: parseWhatsAppCloudConfig(notificationTransport, env),
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
  if (
    value === "disabled" ||
    value === "log" ||
    value === "http" ||
    value === "whatsapp_cloud"
  ) {
    return value;
  }
  throw new Error(`Unsupported NOTIFICATION_TRANSPORT value: ${value}`);
}

function parseWhatsAppCloudConfig(
  transport: NotificationTransportName,
  env: NodeJS.ProcessEnv,
): WhatsAppCloudConfig | undefined {
  if (transport !== "whatsapp_cloud") {
    return undefined;
  }

  const phoneNumberId = requiredString(
    env.WHATSAPP_PHONE_NUMBER_ID,
    "WHATSAPP_PHONE_NUMBER_ID",
  );
  const accessToken = requiredString(
    env.WHATSAPP_ACCESS_TOKEN,
    "WHATSAPP_ACCESS_TOKEN",
  );
  const apiVersion = (env.WHATSAPP_API_VERSION ?? "v21.0").trim() || "v21.0";

  return {
    phoneNumberId,
    accessToken,
    apiVersion,
    timeoutMs: parsePositiveInteger(env.WHATSAPP_TIMEOUT_MS, 10_000),
  };
}

function parseNotificationHttpConfig(
  transport: NotificationTransportName,
  env: NodeJS.ProcessEnv,
): NotificationHttpConfig | undefined {
  if (transport !== "http") {
    return undefined;
  }

  const url = requiredString(env.NOTIFICATION_HTTP_URL, "NOTIFICATION_HTTP_URL");
  const authValue = requiredString(
    env.NOTIFICATION_HTTP_AUTH_VALUE,
    "NOTIFICATION_HTTP_AUTH_VALUE",
  );
  const authHeader = (env.NOTIFICATION_HTTP_AUTH_HEADER ?? "Authorization").trim();
  if (authHeader === "") {
    throw new Error("NOTIFICATION_HTTP_AUTH_HEADER cannot be blank");
  }

  validateHttpUrl(url);

  return {
    url,
    authHeader,
    authValue,
    from: (env.NOTIFICATION_FROM ?? "Xtiitch").trim() || "Xtiitch",
    timeoutMs: parsePositiveInteger(env.NOTIFICATION_HTTP_TIMEOUT_MS, 10_000),
  };
}

function requiredString(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required when NOTIFICATION_TRANSPORT=http`);
  }
  return value.trim();
}

function validateHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Expected NOTIFICATION_HTTP_URL to be a valid URL, got ${value}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("NOTIFICATION_HTTP_URL must use http or https");
  }
}
