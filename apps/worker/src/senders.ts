import type { NotificationTransportName } from "./config";
import type { NotificationSender, OutboundMessage } from "./outbox";

export function createNotificationSender(transport: NotificationTransportName): NotificationSender {
  switch (transport) {
    case "disabled":
      return new DisabledNotificationSender();
    case "log":
      return new LogNotificationSender();
  }
}

class LogNotificationSender implements NotificationSender {
  async send(message: OutboundMessage): Promise<void> {
    assertSendable(message);
    console.log(
      {
        messageId: message.messageId,
        businessId: message.businessId,
        channel: message.channel,
        kind: message.kind,
        recipient: maskRecipient(message.recipient),
      },
      "notification outbox dry-run send",
    );
  }
}

class DisabledNotificationSender implements NotificationSender {
  async send(message: OutboundMessage): Promise<void> {
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

function maskRecipient(recipient: string): string {
  if (recipient.length <= 4) {
    return "****";
  }
  return `${"*".repeat(Math.max(0, recipient.length - 4))}${recipient.slice(-4)}`;
}
