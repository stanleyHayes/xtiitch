import { requestJSON } from "./utils";
import type { AdminUser } from "./users";

export type AdminRole = "owner" | "operator" | "support";

export type AdminAuthResult = {
  adminUserId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};
type AdminAuthPayload = {
  admin_user_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

export type AdminUserPayload = {
  admin_user_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};
function mapAuth(payload: AdminAuthPayload): AdminAuthResult {
  return {
    adminUserId: payload.admin_user_id,
    email: payload.email,
    displayName: payload.display_name,
    role: payload.role,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessExpiresAt: payload.access_expires_at,
    refreshExpiresAt: payload.refresh_expires_at,
  };
}

export function mapUser(payload: AdminUserPayload): AdminUser {
  return {
    adminUserId: payload.admin_user_id,
    email: payload.email,
    displayName: payload.display_name,
    role: payload.role,
    isActive: payload.is_active,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const authApi = {
  login: async (email: string, password: string) => {
    const payload = await requestJSON<AdminAuthPayload>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return mapAuth(payload);
  },
  refresh: async (refreshToken: string) => {
    const payload = await requestJSON<AdminAuthPayload>("/admin/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return mapAuth(payload);
  },
  logout: (refreshToken: string) =>
    requestJSON<undefined>("/admin/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  me: async (accessToken: string) => {
    const payload = await requestJSON<AdminUserPayload>("/admin/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return mapUser(payload);
  },
};
