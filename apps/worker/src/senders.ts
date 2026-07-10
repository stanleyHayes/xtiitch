import type {
  ArkeselSmsConfig,
  NotificationHttpConfig,
  NotificationTransportName,
  WhatsAppCloudConfig,
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
  whatsappCloud?: WhatsAppCloudConfig;
  arkesel?: ArkeselSmsConfig;
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
    case "whatsapp_cloud": {
      if (!config.whatsappCloud) {
        throw new Error(
          "WhatsApp Cloud notification transport is missing configuration",
        );
      }
      // The production transport routes by channel: order-lifecycle SMS goes
      // over Arkesel, WhatsApp-channel messages over the WhatsApp Cloud API.
      const routes: ChannelSenders = {
        whatsapp: new WhatsAppCloudSender(config.whatsappCloud, config.fetcher),
      };
      if (config.arkesel) {
        routes.sms = new ArkeselSmsSender(config.arkesel, config.fetcher);
      }
      return new ChannelRoutedSender(routes);
    }
  }
}

type ChannelSenders = Partial<Record<string, NotificationSender>>;

// ChannelRoutedSender dispatches each message to the sender registered for its
// channel. A message on a channel with no registered sender (e.g. an SMS when
// Arkesel credentials are absent) fails loudly rather than being dropped.
export class ChannelRoutedSender implements NotificationSender {
  constructor(private readonly senders: ChannelSenders) {}

  async send(
    message: OutboundMessage,
  ): Promise<NotificationSendResult | undefined> {
    const sender = this.senders[message.channel];
    if (!sender) {
      throw new Error(
        `no notification sender configured for channel ${message.channel}`,
      );
    }
    return sender.send(message);
  }
}

// WhatsAppCloudSender delivers order updates through the WhatsApp Business Cloud
// API (Meta Graph API). Messages render as plain WhatsApp text; the recipient is
// a Ghana phone number normalised to E.164 (no leading +).
export class WhatsAppCloudSender implements NotificationSender {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: WhatsAppCloudConfig,
    fetcher: Fetcher = fetch,
  ) {
    this.fetcher = fetcher;
  }

  async send(message: OutboundMessage): Promise<NotificationSendResult> {
    assertSendable(message);
    if (message.channel !== "whatsapp") {
      throw new Error(
        `WhatsApp Cloud transport cannot send a ${message.channel} message`,
      );
    }

    const to = normalizeGhanaMsisdn(message.recipient);
    if (to === "") {
      throw new Error("notification recipient is not a usable phone number");
    }

    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.accessToken}`,
          "X-Xtiitch-Message-Id": message.messageId,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: renderNotificationText(message) },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `whatsapp cloud api returned ${response.status}: ${await responseSnippet(response)}`,
        );
      }
      return whatsAppResult(response);
    } finally {
      clearTimeout(timeout);
    }
  }
}

// normalizeGhanaMsisdn converts a locally-formatted Ghana number to the E.164
// digits WhatsApp expects (country code 233, no leading + or 0).
export function normalizeGhanaMsisdn(recipient: string): string {
  let digits = recipient.replace(/\D/g, "");
  if (digits === "") {
    return "";
  }
  if (digits.startsWith("233")) {
    // already country-coded
  } else if (digits.startsWith("0")) {
    digits = `233${digits.slice(1)}`;
  } else if (digits.length === 9) {
    // bare subscriber number without the national trunk 0
    digits = `233${digits}`;
  }
  return digits;
}

async function whatsAppResult(
  response: Response,
): Promise<NotificationSendResult> {
  const text = await response.text().catch(() => "");
  if (text.trim() === "") {
    return { providerResponse: { status: response.status } };
  }
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(text) as unknown;
    parsed =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : { body: text.slice(0, 500), status: response.status };
  } catch {
    parsed = { body: text.slice(0, 500), status: response.status };
  }

  // WhatsApp Cloud returns { messages: [{ id }] }.
  let providerMessageId: string | undefined;
  const messages = parsed.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const first = messages[0] as Record<string, unknown>;
    if (typeof first.id === "string" && first.id.trim() !== "") {
      providerMessageId = first.id;
    }
  }
  return { providerMessageId, providerResponse: parsed };
}

// ArkeselSmsSender delivers order-lifecycle notifications as SMS via the Arkesel
// v2 API. The recipient is a Ghana phone number normalised to E.164 digits (no
// leading +). A non-2xx response, or a JSON body whose `status` is not
// "success", is treated as a failure so the outbox retries rather than marking
// an undelivered message sent.
export class ArkeselSmsSender implements NotificationSender {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: ArkeselSmsConfig,
    fetcher: Fetcher = fetch,
  ) {
    this.fetcher = fetcher;
  }

  async send(message: OutboundMessage): Promise<NotificationSendResult> {
    assertSendable(message);
    if (message.channel !== "sms") {
      throw new Error(
        `Arkesel SMS transport cannot send a ${message.channel} message`,
      );
    }

    const to = normalizeGhanaMsisdn(message.recipient);
    if (to === "") {
      throw new Error("notification recipient is not a usable phone number");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(
        "https://sms.arkesel.com/api/v2/sms/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": this.config.apiKey,
            "X-Xtiitch-Message-Id": message.messageId,
          },
          body: JSON.stringify({
            sender: this.config.senderId,
            message: renderNotificationText(message),
            recipients: [to],
          }),
          signal: controller.signal,
        },
      );

      return await arkeselResult(response);
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function arkeselResult(
  response: Response,
): Promise<NotificationSendResult> {
  const text = await response.text().catch(() => "");
  let parsed: Record<string, unknown> | undefined;
  if (text.trim() !== "") {
    try {
      const value = JSON.parse(text) as unknown;
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      parsed = undefined;
    }
  }

  // Arkesel returns { status: "success", data: { ... } } on acceptance. Anything
  // else — a non-2xx status or a body we cannot confirm as successful — is a
  // failure the outbox should retry.
  if (!response.ok || parsed?.status !== "success") {
    throw new Error(
      `arkesel sms api returned ${response.status}: ${
        text.slice(0, 500) || response.statusText
      }`,
    );
  }

  return {
    providerMessageId: arkeselMessageId(parsed),
    providerResponse: parsed,
  };
}

// Arkesel echoes per-recipient results under data.recipients[]; surface the
// first recipient id as the provider message id when present.
function arkeselMessageId(parsed: Record<string, unknown>): string | undefined {
  const data = parsed.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const recipients = (data as Record<string, unknown>).recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return undefined;
  }
  const first = recipients[0];
  if (first === null || typeof first !== "object") {
    return undefined;
  }
  const id = (first as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() !== "" ? id : undefined;
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
    case "order_stage_advanced": {
      // Stages are business-defined, so the message names the stage the order
      // just reached; fall back to a generic line when the name is missing.
      const stage = stringPayload(message.payload.stage);
      const text = stage
        ? `Update: your order has moved to the "${stage}" stage.`
        : "Update: your order has moved to the next production stage.";
      return withDesign(text, design);
    }
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
    case "new_order_owner": {
      const customer = stringPayload(message.payload.customer);
      const who = customer ? ` from ${customer}` : "";
      const item = design ? ` (${design})` : "";
      const amount = message.payload.amount_minor;
      // Bespoke orders have no fixed price yet (amount 0), so omit the price.
      const price =
        typeof amount === "number" && Number.isFinite(amount) && amount > 0
          ? ` — ${new Intl.NumberFormat("en-GH", {
              style: "currency",
              currency: "GHS",
            }).format(amount / 100)}`
          : "";
      return `New Xtiitch order${item}${who}${price}. Open your dashboard to manage it.`;
    }
    default:
      return withDesign("Your Xtiitch order has an update.", design);
  }
}

function providerPayload(
  message: OutboundMessage,
  from: string,
): Record<string, unknown> {
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

async function providerResult(
  response: Response,
): Promise<NotificationSendResult> {
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

function providerMessageId(
  response: Record<string, unknown>,
): string | undefined {
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
