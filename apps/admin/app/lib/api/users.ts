import { requestJSON } from "./utils";
import { mapUser } from "./auth";
import type { AdminRole, AdminUserPayload } from "./auth";

export type AdminUser = {
  adminUserId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminPreferences = {
  timezone: string;
  phoneNumber: string;
  notifyEmail: boolean;
  notifySms: boolean;
  alertVerifications: boolean;
  alertMoneyRails: boolean;
  alertSubscriptions: boolean;
  alertPromotions: boolean;
  alertRisk: boolean;
  alertSupport: boolean;
  dailyDigestTime: string;
  updatedAt?: string;
};

export type AdminProfileSettings = {
  user: AdminUser;
  preferences: AdminPreferences;
};

export type AdminRoleDefinition = {
  role: AdminRole;
  label: string;
  permissions: string[];
};

export type AdminPermissionDefinition = {
  permission: string;
  label: string;
};

type AdminPreferencesPayload = {
  timezone: string;
  phone_number: string;
  notify_email: boolean;
  notify_sms: boolean;
  alert_verifications: boolean;
  alert_money_rails: boolean;
  alert_subscriptions: boolean;
  alert_promotions: boolean;
  alert_risk: boolean;
  alert_support: boolean;
  daily_digest_time: string;
  updated_at?: string;
};

type AdminProfileSettingsPayload = {
  user: AdminUserPayload;
  preferences: AdminPreferencesPayload;
};
type AdminRolePayload = {
  role: AdminRole;
  label: string;
  permissions: string[];
};

type AdminPermissionPayload = {
  permission: string;
  label: string;
};
function mapPreferences(payload: AdminPreferencesPayload): AdminPreferences {
  return {
    timezone: payload.timezone,
    phoneNumber: payload.phone_number,
    notifyEmail: payload.notify_email,
    notifySms: payload.notify_sms,
    alertVerifications: payload.alert_verifications,
    alertMoneyRails: payload.alert_money_rails,
    alertSubscriptions: payload.alert_subscriptions,
    alertPromotions: payload.alert_promotions,
    alertRisk: payload.alert_risk,
    alertSupport: payload.alert_support,
    dailyDigestTime: payload.daily_digest_time,
    updatedAt: payload.updated_at,
  };
}

function mapProfileSettings(
  payload: AdminProfileSettingsPayload,
): AdminProfileSettings {
  return {
    user: mapUser(payload.user),
    preferences: mapPreferences(payload.preferences),
  };
}
function mapRole(payload: AdminRolePayload): AdminRoleDefinition {
  return {
    role: payload.role,
    label: payload.label,
    permissions: payload.permissions,
  };
}

function mapPermission(
  payload: AdminPermissionPayload,
): AdminPermissionDefinition {
  return {
    permission: payload.permission,
    label: payload.label,
  };
}

export const usersApi = {
  profileSettings: async (accessToken: string) => {
    const payload = await requestJSON<AdminProfileSettingsPayload>(
      "/admin/settings/profile",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return mapProfileSettings(payload);
  },
  updateProfile: (
    accessToken: string,
    input: { displayName: string; email: string },
  ) =>
    requestJSON<AdminUserPayload>("/admin/settings/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        display_name: input.displayName,
        email: input.email,
      }),
    }).then(mapUser),
  updatePreferences: (
    accessToken: string,
    input: {
      timezone: string;
      phoneNumber: string;
      notifyEmail: boolean;
      notifySms: boolean;
      alertVerifications: boolean;
      alertMoneyRails: boolean;
      alertSubscriptions: boolean;
      alertPromotions: boolean;
      alertRisk: boolean;
      alertSupport: boolean;
      dailyDigestTime: string;
    },
  ) =>
    requestJSON<AdminPreferencesPayload>("/admin/settings/preferences", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        timezone: input.timezone,
        phone_number: input.phoneNumber,
        notify_email: input.notifyEmail,
        notify_sms: input.notifySms,
        alert_verifications: input.alertVerifications,
        alert_money_rails: input.alertMoneyRails,
        alert_subscriptions: input.alertSubscriptions,
        alert_promotions: input.alertPromotions,
        alert_risk: input.alertRisk,
        alert_support: input.alertSupport,
        daily_digest_time: input.dailyDigestTime,
      }),
    }).then(mapPreferences),
  roles: async (accessToken: string) => {
    const payload = await requestJSON<{
      roles: AdminRolePayload[];
      permissions: AdminPermissionPayload[];
    }>("/admin/roles", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      roles: payload.roles.map(mapRole),
      permissions: payload.permissions.map(mapPermission),
    };
  },
  updateRolePermissions: (
    accessToken: string,
    role: AdminRole,
    permissions: string[],
  ) =>
    requestJSON<AdminRolePayload>(`/admin/roles/${encodeURIComponent(role)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ permissions }),
    }).then(mapRole),
  listUsers: async (accessToken: string) => {
    const payload = await requestJSON<{ users: AdminUserPayload[] }>(
      "/admin/users",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.users.map(mapUser);
  },
  createUser: (
    accessToken: string,
    input: {
      displayName: string;
      email: string;
      password: string;
      role: AdminRole;
    },
  ) =>
    requestJSON<AdminUserPayload>("/admin/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        display_name: input.displayName,
        email: input.email,
        password: input.password,
        role: input.role,
      }),
    }).then(mapUser),
  updateUser: (
    accessToken: string,
    userId: string,
    input: { displayName: string; role: AdminRole; isActive: boolean },
  ) =>
    requestJSON<AdminUserPayload>(
      `/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          display_name: input.displayName,
          role: input.role,
          is_active: input.isActive,
        }),
      },
    ).then(mapUser),
};
