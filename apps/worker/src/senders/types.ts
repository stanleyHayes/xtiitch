import type {
  ArkeselSmsConfig,
  ExpoPushConfig,
  NotificationHttpConfig,
  NotificationTransportName,
  WhatsAppCloudConfig,
} from "../config";
import type { DeviceTokenSink } from "../outbox";

export type Fetcher = typeof fetch;

export type NotificationSenderFactoryConfig = {
  transport: NotificationTransportName;
  http?: NotificationHttpConfig;
  whatsappCloud?: WhatsAppCloudConfig;
  arkesel?: ArkeselSmsConfig;
  expoPush?: ExpoPushConfig;
  // Where a dead push token is retired. Optional: without it push still works
  // and dead tokens are still terminal, they just accumulate.
  devices?: DeviceTokenSink;
  fetcher?: Fetcher;
};
