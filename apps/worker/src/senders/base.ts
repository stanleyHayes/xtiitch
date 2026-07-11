import type { NotificationSender, OutboundMessage } from "../outbox";
import { maskRecipient, renderNotificationText } from "./templates";

export function assertSendable(message: OutboundMessage): void {
  if (message.recipient.trim() === "") {
    throw new Error("notification recipient is missing");
  }
  if (message.channel !== "whatsapp" && message.channel !== "sms") {
    throw new Error(`unsupported notification channel: ${message.channel}`);
  }
}

export class LogNotificationSender implements NotificationSender {
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

export class DisabledNotificationSender implements NotificationSender {
  async send(message: OutboundMessage): Promise<undefined> {
    assertSendable(message);
    throw new Error("notification transport is disabled");
  }
}
