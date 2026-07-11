import type {
  NotificationSendResult,
  NotificationSender,
  OutboundMessage,
} from "../outbox";

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
