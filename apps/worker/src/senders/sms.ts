import type {
  NotificationSendResult,
  NotificationSender,
  OutboundMessage,
} from "../outbox";
import type { ArkeselSmsConfig } from "../config";
import type { Fetcher } from "./types";
import { assertSendable } from "./base";
import { normalizeGhanaMsisdn } from "./whatsapp";
import { renderNotificationText } from "./templates";

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
