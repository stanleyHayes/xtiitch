import type {
  NotificationHttpConfig,
  NotificationTransportName,
} from "./config";
import type {
  NotificationSender,
  NotificationSendResult,
  OutboundMessage,
} from "./outbox";

type Fetcher = typeof fetch;

export type NotificationSenderFactoryConfig = {
  transport: NotificationTransportName;
  http?: NotificationHttpConfig;
  fetcher?: Fetcher;
};

export function createNotificationSender(
  config: NotificationSenderFactoryConfig,
): NotificationSender {
  switch (config.transport) {
    case "disabled":
      return new DisabledNotificationSender();
    case "log":
      return new LogNotificationSender();
    case "http":
      if (!config.http) {
        throw new Error("HTTP notification transport is missing configuration");
      }
      return new HttpNotificationSender(config.http, config.fetcher);
  }
}

export class HttpNotificationSender implements NotificationSender {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: NotificationHttpConfig,
    fetcher: Fetcher = fetch,
  ) {
    this.fetcher = fetcher;
  }

  async send(message: OutboundMessage): Promise<NotificationSendResult> {
    assertSendable(message);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(this.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": message.messageId,
          "X-Xtiitch-Message-Id": message.messageId,
          [this.config.authHeader]: this.config.authValue,
        },
        body: JSON.stringify(providerPayload(message, this.config.from)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `notification provider returned ${response.status}: ${await responseSnippet(response)}`,
        );
      }
      return providerResult(response);
    } finally {
      clearTimeout(timeout);
    }
  }
}

class LogNotificationSender implements NotificationSender {
  async send(message: OutboundMessage): Promise<undefined> {
    assertSendable(message);
    console.log(
      {
        messageId: message.messageId,
        businessId: message.businessId,
        channel: message.channel,
        kind: message.kind,
        recipient: maskRecipient(message.recipient),
        text: renderNotificationText(message),
      },
      "notification outbox dry-run send",
    );
    return undefined;
  }
}

class DisabledNotificationSender implements NotificationSender {
  async send(message: OutboundMessage): Promise<undefined> {
    assertSendable(message);
    throw new Error("notification transport is disabled");
  }
}

function assertSendable(message: OutboundMessage): void {
  if (message.recipient.trim() === "") {
    throw new Error("notification recipient is missing");
  }
  if (message.channel !== "whatsapp" && message.channel !== "sms") {
    throw new Error(`unsupported notification channel: ${message.channel}`);
  }
}

export function renderNotificationText(message: OutboundMessage): string {
  const design = stringPayload(message.payload.design);
  switch (message.kind) {
    case "order_confirmed":
      return withDesign(
        "Your order is confirmed. We will update you when production moves forward.",
        design,
      );
    case "order_fulfilled":
      return withDesign(
        "Your order is ready. Please contact the business to arrange pickup or delivery.",
        design,
      );
    case "booking_confirmed":
      return `Your home-visit booking is confirmed${dateClause(
        message.payload.slot_start,
      )}. ${withDesign("We will see you then.", design)}`;
    case "balance_paid":
      return `${amountClause(
        message.payload.amount_minor,
      )} balance payment received. ${withDesign(
        "Thank you; your order record is up to date.",
        design,
      )}`;
    case "handover_dispatched":
      return `${withDesign("Your order has been dispatched.", design)}${courierClause(
        message.payload.courier,
      )}`;
    case "handover_completed":
      return withDesign("Your order handover is complete. Thank you.", design);
    default:
      return withDesign("Your Xtiitch order has an update.", design);
  }
}

function providerPayload(message: OutboundMessage, from: string): Record<string, unknown> {
  return {
    message_id: message.messageId,
    business_id: message.businessId,
    channel: message.channel,
    kind: message.kind,
    recipient: message.recipient,
    from,
    text: renderNotificationText(message),
    payload: message.payload,
  };
}

function withDesign(text: string, design: string): string {
  if (design === "") {
    return text;
  }
  return `${text} Design: ${design}.`;
}

function dateClause(value: unknown): string {
  const date = stringPayload(value);
  if (date === "") {
    return "";
  }
  return ` for ${new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(date))}`;
}

function amountClause(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Your";
  }
  return `${new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(value / 100)}`;
}

function courierClause(value: unknown): string {
  const courier = stringPayload(value);
  if (courier === "") {
    return "";
  }
  return ` Courier: ${courier}.`;
}

function stringPayload(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function responseSnippet(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text.slice(0, 500) || response.statusText;
}

async function providerResult(response: Response): Promise<NotificationSendResult> {
  const text = await response.text().catch(() => "");
  if (text.trim() === "") {
    return { providerResponse: { status: response.status } };
  }

  let providerResponse: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text) as unknown;
    providerResponse =
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { body: text.slice(0, 500), status: response.status };
  } catch {
    providerResponse = { body: text.slice(0, 500), status: response.status };
  }

  return {
    providerMessageId: providerMessageId(providerResponse),
    providerResponse,
  };
}

function providerMessageId(response: Record<string, unknown>): string | undefined {
  for (const key of ["provider_message_id", "message_id", "id"]) {
    const value = response[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function maskRecipient(recipient: string): string {
  if (recipient.length <= 4) {
    return "****";
  }
  return `${"*".repeat(Math.max(0, recipient.length - 4))}${recipient.slice(-4)}`;
}
