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
// is the delivery channel for business-facing messages (subscription reminders).
export type WhatsAppCloudConfig = {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  timeoutMs: number;
};

// Arkesel SMS API (https://sms.arkesel.com). Order-lifecycle notifications go by
// SMS because business-initiated WhatsApp messages do not reliably deliver
// outside the 24h session window / approved-template constraints.
export type ArkeselSmsConfig = {
  apiKey: string;
  senderId: string;
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
  arkesel?: ArkeselSmsConfig;
};

const defaultDatabaseUrl =
  "postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const notificationTransport = parseTransport(env.NOTIFICATION_TRANSPORT);
  const config: WorkerConfig = {
    databaseUrl: env.DATABASE_URL ?? defaultDatabaseUrl,
    redisConnection: {
      url: env.REDIS_URL ?? "redis://localhost:6379/0",
      maxRetriesPerRequest: null,
    } satisfies RedisOptions,
    queueName: env.WORKER_QUEUE_NAME ?? "xtiitch.outbox",
    outboxDrainEnabled: parseBoolean(env.OUTBOX_DRAIN_ENABLED, true),
    outboxPollIntervalMs: parsePositiveInteger(
      env.OUTBOX_POLL_INTERVAL_MS,
      15_000,
    ),
    outboxBatchSize: parsePositiveInteger(env.OUTBOX_BATCH_SIZE, 25),
    outboxLeaseSeconds: parsePositiveInteger(env.OUTBOX_LEASE_SECONDS, 300),
    outboxMaxAttempts: parsePositiveInteger(env.OUTBOX_MAX_ATTEMPTS, 5),
    outboxRetryBaseDelayMs: parsePositiveInteger(
      env.OUTBOX_RETRY_BASE_DELAY_MS,
      60_000,
    ),
    outboxRetryMaxDelayMs: parsePositiveInteger(
      env.OUTBOX_RETRY_MAX_DELAY_MS,
      3_600_000,
    ),
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
    arkesel: parseArkeselSmsConfig(notificationTransport, env),
  };

  validateProductionWorkerConfig(config, env);
  return config;
}

// In production the worker must actually deliver notifications and talk to the
// real database — refuse to start on the dev defaults (log/disabled transport,
// the local database) so customer order updates are never silently dropped.
function validateProductionWorkerConfig(
  config: WorkerConfig,
  env: NodeJS.ProcessEnv,
): void {
  if (env.NODE_ENV !== "production") {
    return;
  }
  const problems: string[] = [];
  if (
    config.notificationTransport === "log" ||
    config.notificationTransport === "disabled"
  ) {
    problems.push(
      `NOTIFICATION_TRANSPORT must deliver messages in production (got "${config.notificationTransport}"; use whatsapp_cloud or http)`,
    );
  }
  if (config.databaseUrl === defaultDatabaseUrl) {
    problems.push("DATABASE_URL must point at the production database");
  }
  if (problems.length > 0) {
    throw new Error(
      `refusing to start worker: insecure production configuration:\n  - ${problems.join("\n  - ")}`,
    );
  }
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
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

// Arkesel is the SMS provider for order-lifecycle notifications and rides
// alongside the whatsapp_cloud transport (which still carries WhatsApp-channel
// messages). Credentials are optional: if they are absent the composite sender
// has no SMS route and an SMS message fails loudly at send time rather than
// being silently dropped.
function parseArkeselSmsConfig(
  transport: NotificationTransportName,
  env: NodeJS.ProcessEnv,
): ArkeselSmsConfig | undefined {
  if (transport !== "whatsapp_cloud") {
    return undefined;
  }

  const apiKey = (env.ARKESEL_API_KEY ?? "").trim();
  const senderId = (env.SMS_SENDER_ID ?? "").trim();
  if (apiKey === "" || senderId === "") {
    return undefined;
  }

  return {
    apiKey,
    senderId,
    timeoutMs: parsePositiveInteger(env.ARKESEL_TIMEOUT_MS, 10_000),
  };
}

function parseNotificationHttpConfig(
  transport: NotificationTransportName,
  env: NodeJS.ProcessEnv,
): NotificationHttpConfig | undefined {
  if (transport !== "http") {
    return undefined;
  }

  const url = requiredString(
    env.NOTIFICATION_HTTP_URL,
    "NOTIFICATION_HTTP_URL",
  );
  const authValue = requiredString(
    env.NOTIFICATION_HTTP_AUTH_VALUE,
    "NOTIFICATION_HTTP_AUTH_VALUE",
  );
  const authHeader = (
    env.NOTIFICATION_HTTP_AUTH_HEADER ?? "Authorization"
  ).trim();
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
    // Shared by the whatsapp_cloud and http transports, so the message names the
    // missing variable rather than assuming a specific transport.
    throw new Error(
      `${name} is required for the configured NOTIFICATION_TRANSPORT`,
    );
  }
  return value.trim();
}

function validateHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Expected NOTIFICATION_HTTP_URL to be a valid URL, got ${value}`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("NOTIFICATION_HTTP_URL must use http or https");
  }
}
