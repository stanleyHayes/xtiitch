import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiBaseUrl } from "./api-base";
import {
  deleteSessionValue,
  getSessionValue,
  setSessionValue,
} from "./session-storage";

const PUSH_TOKEN_KEY = "xtiitch.business.push-token.v1";
const ORDERS_CHANNEL_ID = "orders";

type AuthedRequest = (path: string, init?: RequestInit) => Promise<Response>;

export type PushRegistrationResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "permission_denied"
        | "project_not_configured"
        | "registration_failed";
    };

export function configureNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerBusinessPushNotifications(
  request: AuthedRequest,
): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") return { ok: false, reason: "unsupported" };

  await ensureAndroidNotificationChannels();
  const permission = await Notifications.getPermissionsAsync();
  const finalPermission =
    permission.status === "granted"
      ? permission
      : await Notifications.requestPermissionsAsync();
  if (finalPermission.status !== "granted") {
    return { ok: false, reason: "permission_denied" };
  }

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId;
  if (!projectId) return { ok: false, reason: "project_not_configured" };

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;
    const response = await request("/notifications/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        device_name: `${Constants.expoConfig?.name ?? "Xtiitch"} on ${Platform.OS}`,
      }),
    });
    if (!response.ok) return { ok: false, reason: "registration_failed" };
    await setSessionValue(PUSH_TOKEN_KEY, token);
    return { ok: true, token };
  } catch {
    return { ok: false, reason: "registration_failed" };
  }
}

export async function unregisterBusinessPushNotifications(
  accessToken: string,
): Promise<void> {
  const token = await getSessionValue(PUSH_TOKEN_KEY).catch(() => null);
  if (!token) return;

  try {
    const response = await fetch(
      `${apiBaseUrl()}/notifications/devices/unregister`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      },
    );
    if (response.ok) await deleteSessionValue(PUSH_TOKEN_KEY);
  } catch {
    // Keep the token locally so a later authenticated launch can replace or
    // unregister it instead of losing the only handle to the server record.
  }
}

export function notificationOrderId(
  response: Notifications.NotificationResponse,
): string | null {
  const value = response.notification.request.content.data?.order_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL_ID, {
    name: "New orders",
    description: "Paid order alerts for your Xtiitch studio.",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 150, 250],
  });
}
