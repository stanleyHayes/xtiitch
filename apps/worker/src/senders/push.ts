import {
  PermanentSendError,
  type DeviceTokenSink,
  type NotificationSendResult,
  type NotificationSender,
  type OutboundMessage,
} from "../outbox";
import type { ExpoPushConfig } from "../config";
import type { Fetcher } from "./types";
import { assertSendable } from "./base";
import { renderPushNotification } from "./templates";

// ExpoPushSender delivers a notification to one mobile device through Expo's
// push service, which fans out to APNs and FCM on our behalf.
//
// The one thing this transport must get right is that ExpoPushService ANSWERS
// 200 FOR FAILURES. Sending to a token that was never registered, or to a
// string that is not a token at all, returns HTTP 200 with a body of
// {"data":{"status":"error","details":{"error":"DeviceNotRegistered"}}}.
// A transport that trusts the status code marks those messages sent, and the
// dead token stays on file being pushed to forever. Every send therefore has to
// be judged on the ticket inside the body, never on the response status.
export class ExpoPushSender implements NotificationSender {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: ExpoPushConfig,
    fetcher: Fetcher = fetch,
    // Optional so the sender can be tested, and constructed, without a
    // database. When absent a dead token is still terminal — it just is not
    // cleaned up.
    private readonly devices?: DeviceTokenSink,
  ) {
    this.fetcher = fetcher;
  }

  async send(message: OutboundMessage): Promise<NotificationSendResult> {
    assertSendable(message);
    if (message.channel !== "push") {
      throw new Error(
        `Expo push transport cannot send a ${message.channel} message`,
      );
    }

    const { title, body } = renderPushNotification(message);
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
    };
    // Expo only requires this when the project has enhanced security enabled,
    // but it rejects a WRONG token with 401 — so send it only when configured.
    if (this.config.accessToken !== "") {
      headers.authorization = `Bearer ${this.config.accessToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(this.config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: message.recipient,
          title,
          body,
          sound: "default",
          // Orders are time-sensitive; the customer is waiting on the owner to
          // confirm and start work.
          priority: "high",
          // The Android channel the app creates for order alerts. Android
          // silently downgrades notifications with no channel.
          channelId: "orders",
          // What the app needs to open the right screen when the notification
          // is tapped, rather than dumping the owner on a dashboard.
          data: {
            kind: message.kind,
            order_id: stringField(message.payload.order_id),
            message_id: message.messageId,
          },
        }),
        signal: controller.signal,
      });

      return await this.readTicket(response, message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readTicket(
    response: Response,
    message: OutboundMessage,
  ): Promise<NotificationSendResult> {
    const text = await response.text().catch(() => "");
    const parsed = parseJsonObject(text);

    // A rejected request (too many messages, malformed body) comes back under
    // `errors` with an explicit transience flag. Trust it: Expo knows better
    // than we do whether trying again could work.
    const requestErrors = parsed?.errors;
    if (Array.isArray(requestErrors) && requestErrors.length > 0) {
      const first = asRecord(requestErrors[0]) ?? {};
      const detail = `${stringField(first.code) || "error"}: ${
        stringField(first.message) || text.slice(0, 300)
      }`;
      if (first.isTransient === false) {
        throw new PermanentSendError(`expo push rejected the request — ${detail}`);
      }
      throw new Error(`expo push request failed — ${detail}`);
    }

    if (!response.ok) {
      // 5xx and rate limiting are worth another attempt; a 4xx we could not
      // parse is not going to become valid on its own.
      if (response.status >= 500 || response.status === 429) {
        throw new Error(
          `expo push api returned ${response.status}: ${text.slice(0, 300)}`,
        );
      }
      throw new PermanentSendError(
        `expo push api returned ${response.status}: ${text.slice(0, 300)}`,
      );
    }

    const ticket = firstTicket(parsed?.data);
    if (!ticket) {
      throw new Error(
        `expo push api returned no ticket: ${text.slice(0, 300) || "empty body"}`,
      );
    }

    if (ticket.status === "ok") {
      return {
        providerMessageId: stringField(ticket.id),
        providerResponse: ticket,
      };
    }

    await this.handleTicketError(ticket, message);
    // handleTicketError always throws; this satisfies the return type.
    throw new Error("unreachable");
  }

  private async handleTicketError(
    ticket: Record<string, unknown>,
    message: OutboundMessage,
  ): Promise<never> {
    const details = asRecord(ticket.details) ?? {};
    const code = stringField(details.error);
    const reason =
      stringField(ticket.message) || code || "expo push ticket failed";

    if (code === "DeviceNotRegistered") {
      // The app was uninstalled, or the OS reissued the token. Retire the
      // device so no future order tries to reach it. A failure to clean up
      // must not change the verdict on this message.
      if (this.devices) {
        try {
          await this.devices.forgetPushToken(message.recipient);
        } catch {
          // Logged by the drain loop through the terminal error below; the
          // token will be offered again by the next order and retired then.
        }
      }
      throw new PermanentSendError(`expo push device is gone — ${reason}`);
    }

    // MessageTooBig is our bug and will not fix itself. MismatchSenderId and
    // InvalidCredentials are project misconfiguration — retrying five times an
    // hour hides the problem instead of surfacing it in the dead queue.
    if (
      code === "MessageTooBig" ||
      code === "MismatchSenderId" ||
      code === "InvalidCredentials"
    ) {
      throw new PermanentSendError(`expo push refused the message — ${reason}`);
    }

    // MessageRateExceeded, and anything Expo adds later, back off and retry.
    throw new Error(`expo push ticket failed — ${reason}`);
  }
}

// Expo answers a single message with a `data` OBJECT and a batch with a `data`
// ARRAY. We always send one, but accept either rather than depending on which.
function firstTicket(data: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(data)) {
    return asRecord(data[0]);
  }
  return asRecord(data);
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  if (text.trim() === "") {
    return undefined;
  }
  try {
    return asRecord(JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}
