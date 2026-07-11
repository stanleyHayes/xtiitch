import type {
  NotificationSendResult,
  NotificationSender,
  OutboundMessage,
} from "../outbox";
import type { WhatsAppCloudConfig } from "../config";
import type { Fetcher } from "./types";
import { assertSendable } from "./base";
import { renderNotificationText } from "./templates";

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

async function responseSnippet(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text.slice(0, 500) || response.statusText;
}
