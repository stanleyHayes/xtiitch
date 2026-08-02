import { request } from "./businessApi";

export type OwnProfile = {
  business_id: string;
  user_id: string;
  role: string;
  email: string;
  display_name: string;
  phone: string;
  phone_verified: boolean;
  whatsapp_number: string;
};

export type MFAStatus = {
  enabled: boolean;
  enrolled: boolean;
  backup_codes_left: number;
};

export const businessAccountApi = {
  profile: () => request<OwnProfile>("/auth/business/me"),
  updateProfile: (
    input: Pick<
      OwnProfile,
      "display_name" | "email" | "phone" | "whatsapp_number"
    > & { otp_code?: string },
  ) =>
    request<null>("/auth/business/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  requestPhoneCode: (phone: string) =>
    request<null>("/auth/business/me/phone-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<null>("/auth/business/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),
  mfaStatus: () => request<MFAStatus>("/auth/business/mfa"),
  startMFA: () =>
    request<{ secret: string; provisioning_uri: string }>(
      "/auth/business/mfa/setup",
      { method: "POST" },
    ),
  activateMFA: (code: string) =>
    request<{ enabled: boolean; backup_codes: string[] }>(
      "/auth/business/mfa/activate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
    ),
  disableMFA: (code: string) =>
    request<null>("/auth/business/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  submitIdentity: (input: {
    full_legal_name: string;
    card_number: string;
    id_photo_url: string;
    id_photo_back_url: string;
  }) =>
    request<{ status: string }>("/auth/business/identity-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
};
