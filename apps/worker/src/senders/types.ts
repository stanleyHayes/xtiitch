import type {
  ArkeselSmsConfig,
  NotificationHttpConfig,
  NotificationTransportName,
  WhatsAppCloudConfig,
} from "../config";

export type Fetcher = typeof fetch;

export type NotificationSenderFactoryConfig = {
  transport: NotificationTransportName;
  http?: NotificationHttpConfig;
  whatsappCloud?: WhatsAppCloudConfig;
  arkesel?: ArkeselSmsConfig;
  fetcher?: Fetcher;
};
