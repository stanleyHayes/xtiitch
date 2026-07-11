import { requestJSON } from "./utils";
import type { AdminOperationsHealthStatus } from "./operations";

// Public marketing-site launch flags. Each gates a piece of the public marketing
// surface and defaults OFF (hidden) for launch. The owner flips them on once the
// corresponding experience is ready — the change takes effect immediately with no
// redeploy because the marketing site reads them from GET /v1/branding.
export type MarketingFlags = {
  browseStore: boolean;
  discover: boolean;
  createStore: boolean;
  pricing: boolean;
};

export type AdminPlatformSettings = {
  platformName: string;
  supportEmail: string;
  verificationSlaHours: number;
  payoutReviewThresholdPesewas: number;
  maintenanceMode: boolean;
  brandLogoUrl: string;
  marketingFlags: MarketingFlags;
  aiAssistantAddonEnabled: boolean;
  updatedAt?: string;
};

export type AdminWaitlistLead = {
  id: string;
  name: string;
  business: string;
  phone: string;
  email: string;
  city: string;
  message: string;
  createdAt: string;
};

export type AdminBrandingUploadSignature = {
  signature: string;
  timestamp: number;
  cloud_name: string;
  api_key: string;
  folder: string;
};

export type AdminLaunchReadinessCheck = {
  id: string;
  category: string;
  label: string;
  status: AdminOperationsHealthStatus;
  summary: string;
  detail: string;
  action: string;
  target: string;
  targetLabel: string;
};

export type AdminLaunchReadiness = {
  environment: string;
  readyCount: number;
  watchCount: number;
  blockedCount: number;
  checks: AdminLaunchReadinessCheck[];
  updatedAt: string;
};
type MarketingFlagsPayload = {
  browse_store?: boolean;
  discover?: boolean;
  create_store?: boolean;
  pricing?: boolean;
};

type AdminPlatformSettingsPayload = {
  platform_name: string;
  support_email: string;
  verification_sla_hours: number;
  payout_review_threshold_pesewas: number;
  maintenance_mode: boolean;
  brand_logo_url?: string;
  marketing_flags?: MarketingFlagsPayload | null;
  ai_assistant_addon_enabled?: boolean;
  updated_at?: string;
};

type AdminWaitlistLeadPayload = {
  id: string;
  name: string;
  business: string;
  phone: string;
  email: string;
  city: string;
  message: string;
  created_at: string;
};
type AdminLaunchReadinessCheckPayload = {
  id: string;
  category: string;
  label: string;
  status: AdminOperationsHealthStatus;
  summary: string;
  detail: string;
  action: string;
  target: string;
  target_label: string;
};

type AdminLaunchReadinessPayload = {
  environment: string;
  ready_count: number;
  watch_count: number;
  blocked_count: number;
  checks: AdminLaunchReadinessCheckPayload[];
  updated_at: string;
};
function mapMarketingFlags(
  payload: MarketingFlagsPayload | null | undefined,
): MarketingFlags {
  return {
    browseStore: payload?.browse_store ?? false,
    discover: payload?.discover ?? false,
    createStore: payload?.create_store ?? false,
    pricing: payload?.pricing ?? false,
  };
}

function mapPlatformSettings(
  payload: AdminPlatformSettingsPayload,
): AdminPlatformSettings {
  return {
    platformName: payload.platform_name,
    supportEmail: payload.support_email,
    verificationSlaHours: payload.verification_sla_hours,
    payoutReviewThresholdPesewas: payload.payout_review_threshold_pesewas,
    maintenanceMode: payload.maintenance_mode,
    brandLogoUrl: payload.brand_logo_url ?? "",
    marketingFlags: mapMarketingFlags(payload.marketing_flags),
    aiAssistantAddonEnabled: payload.ai_assistant_addon_enabled ?? true,
    updatedAt: payload.updated_at,
  };
}

function mapWaitlistLead(payload: AdminWaitlistLeadPayload): AdminWaitlistLead {
  return {
    id: payload.id,
    name: payload.name,
    business: payload.business,
    phone: payload.phone,
    email: payload.email,
    city: payload.city,
    message: payload.message,
    createdAt: payload.created_at,
  };
}
function mapAdminLaunchReadiness(
  payload: AdminLaunchReadinessPayload,
): AdminLaunchReadiness {
  return {
    environment: payload.environment,
    readyCount: payload.ready_count,
    watchCount: payload.watch_count,
    blockedCount: payload.blocked_count,
    checks: payload.checks.map((check) => ({
      id: check.id,
      category: check.category,
      label: check.label,
      status: check.status,
      summary: check.summary,
      detail: check.detail,
      action: check.action,
      target: check.target,
      targetLabel: check.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}

export const settingsApi = {
  platformSettings: async (accessToken: string) => {
    const payload = await requestJSON<AdminPlatformSettingsPayload>(
      "/admin/settings/platform",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return mapPlatformSettings(payload);
  },
  updatePlatformSettings: (
    accessToken: string,
    input: {
      platformName: string;
      supportEmail: string;
      verificationSlaHours: number;
      payoutReviewThresholdPesewas: number;
      maintenanceMode: boolean;
      brandLogoUrl: string;
      aiAssistantAddonEnabled: boolean;
    },
  ) =>
    requestJSON<AdminPlatformSettingsPayload>("/admin/settings/platform", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        platform_name: input.platformName,
        support_email: input.supportEmail,
        verification_sla_hours: input.verificationSlaHours,
        payout_review_threshold_pesewas: input.payoutReviewThresholdPesewas,
        maintenance_mode: input.maintenanceMode,
        brand_logo_url: input.brandLogoUrl,
        ai_assistant_addon_enabled: input.aiAssistantAddonEnabled,
      }),
    }).then(mapPlatformSettings),
  signBrandingUpload: (accessToken: string) =>
    requestJSON<AdminBrandingUploadSignature>(
      "/admin/settings/branding/upload-signature",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    ),
  // Partial update: send only the flags that changed. The API returns the full
  // platform-settings object (including marketing_flags) so we map it back like
  // any other platform-settings response.
  updateMarketingFlags: (
    accessToken: string,
    flags: Partial<{
      browseStore: boolean;
      discover: boolean;
      createStore: boolean;
      pricing: boolean;
    }>,
  ) => {
    const body: MarketingFlagsPayload = {};
    if (flags.browseStore !== undefined) body.browse_store = flags.browseStore;
    if (flags.discover !== undefined) body.discover = flags.discover;
    if (flags.createStore !== undefined) body.create_store = flags.createStore;
    if (flags.pricing !== undefined) body.pricing = flags.pricing;
    return requestJSON<AdminPlatformSettingsPayload>(
      "/admin/platform-settings/marketing-flags",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      },
    ).then(mapPlatformSettings);
  },
  waitlistLeads: async (accessToken: string) => {
    const payload = await requestJSON<{
      leads?: AdminWaitlistLeadPayload[] | null;
    }>("/admin/waitlist", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (payload.leads ?? []).map(mapWaitlistLead);
  },
  launchReadiness: (accessToken: string) =>
    requestJSON<AdminLaunchReadinessPayload>("/admin/launch-readiness", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapAdminLaunchReadiness),
};
