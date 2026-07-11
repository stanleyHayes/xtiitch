import type {
  NotificationSendResult,
  NotificationSender,
  OutboundMessage,
} from "../outbox";
import type { NotificationHttpConfig } from "../config";
import type { Fetcher } from "./types";
import { assertSendable } from "./base";
import { renderNotificationText } from "./templates";

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
