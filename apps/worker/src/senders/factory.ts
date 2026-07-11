import type { NotificationSender } from "../outbox";
import { DisabledNotificationSender, LogNotificationSender } from "./base";
import { HttpNotificationSender } from "./http";
import { ChannelRoutedSender } from "./routed";
import { ArkeselSmsSender } from "./sms";
import type { NotificationSenderFactoryConfig } from "./types";
import { WhatsAppCloudSender } from "./whatsapp";

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
      const routes: Record<string, NotificationSender> = {
        whatsapp: new WhatsAppCloudSender(config.whatsappCloud, config.fetcher),
      };
      if (config.arkesel) {
        routes.sms = new ArkeselSmsSender(config.arkesel, config.fetcher);
      }
      return new ChannelRoutedSender(routes);
    }
  }
}
