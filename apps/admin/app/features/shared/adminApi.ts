import { redirect } from "react-router";
import { AdminApiError, adminApi } from "../../lib/api";
import type { AdminSession } from "../../lib/session";
import { AdminLoadResult, AdminProfileSettings, AdminPlatformSettings } from "./types";



export async function loadAdminResource<T>(
  load: () => Promise<T>,
  fallback: T,
  permissionMessage: string,
  unavailableMessage: string,
): Promise<AdminLoadResult<T>> {
  try {
    return { data: await load(), error: null };
  } catch (error) {
    if (!(error instanceof AdminApiError)) {
      throw error;
    }

    return {
      data: fallback,
      error: adminLoaderErrorMessage(
        error,
        permissionMessage,
        unavailableMessage,
      ),
    };
  }
}



export function adminLoaderErrorMessage(
  error: AdminApiError,
  permissionMessage: string,
  unavailableMessage: string,
): string {
  if (error.status === 401) {
    throw redirect("/login");
  }
  if (error.status === 403) {
    return permissionMessage;
  }
  if (error.code === "admin_api_unavailable") {
    return "Admin API is unavailable. The console shell is open, but this section could not load yet.";
  }

  return unavailableMessage;
}



export function fallbackProfileSettings(admin: AdminSession): AdminProfileSettings {
  return {
    user: {
      adminUserId: admin.adminUserId,
      email: admin.adminEmail,
      displayName: admin.adminDisplayName,
      role: admin.adminRole,
      isActive: true,
    },
    preferences: {
      timezone: "Africa/Accra",
      phoneNumber: "",
      notifyEmail: true,
      notifySms: false,
      alertVerifications: true,
      alertMoneyRails: true,
      alertSubscriptions: true,
      alertPromotions: true,
      alertRisk: true,
      alertSupport: true,
      dailyDigestTime: "08:00",
    },
  };
}



export function fallbackPlatformSettings(): AdminPlatformSettings {
  return {
    platformName: "Xtiitch",
    supportEmail: "support@xtiitch.com",
    verificationSlaHours: 24,
    payoutReviewThresholdPesewas: 500000,
    maintenanceMode: false,
    brandLogoUrl: "",
    marketingFlags: {
      browseStore: false,
      discover: false,
      createStore: false,
      pricing: false,
    },
    aiAssistantAddonEnabled: true,
  };
}



// Mirrors the storefront design-upload flow: ask the API for a signed Cloudinary
// payload (owner-gated), push the file straight to Cloudinary, and hand back the
// hosted secure URL to persist as the platform brand logo.
export async function uploadBrandLogo(
  accessToken: string,
  file: File,
): Promise<string | null> {
  const signature = await adminApi.signBrandingUpload(accessToken);
  if (signature.cloud_name === "demo" && signature.api_key === "demo") {
    return null;
  }
  const uploadForm = new FormData();
  uploadForm.set("file", file);
  uploadForm.set("api_key", signature.api_key);
  uploadForm.set("timestamp", String(signature.timestamp));
  uploadForm.set("signature", signature.signature);
  if (signature.folder) {
    uploadForm.set("folder", signature.folder);
  }
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      signature.cloud_name,
    )}/image/upload`,
    { method: "POST", body: uploadForm },
  );
  if (!response.ok) {
    return null;
  }
  const result = (await response.json()) as {
    secure_url?: string;
    url?: string;
  };
  return result.secure_url ?? result.url ?? null;
}
