// Server-side image upload helper for dashboard routes. Mirrors the private
// `uploadDesignImage` used inside routes/dashboard.tsx: it asks the API for a
// signed Cloudinary upload, pushes the file straight to Cloudinary, and returns
// the resulting secure URL (or null if signing/upload was unavailable).
//
// Kept in its own module so routes such as billing-onboarding can reuse the
// exact same upload flow without importing from dashboard.tsx.
import { apiFetch } from "./auth";

type UploadSignature = {
  signature: string;
  timestamp: number;
  cloud_name: string;
  api_key: string;
  folder: string;
};

type CloudinaryUploadResult = {
  secure_url?: string;
  url?: string;
};

export async function uploadImage(
  request: Request,
  file: File,
): Promise<string | null> {
  const signatureResponse = await apiFetch(
    request,
    "/media/design-upload-signature",
    { method: "POST" },
  );
  if (!signatureResponse.ok) {
    return null;
  }
  // The signature body and the Cloudinary round-trip are both network calls
  // outside apiFetch's failure handling — a dropped connection or a non-JSON
  // body must degrade to "no upload" (null), never throw out of the action
  // and crash the page.
  try {
    const signature = (await signatureResponse.json()) as UploadSignature;
    // The API returns demo credentials when Cloudinary is not configured; there
    // is nowhere to upload to in that case.
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

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloud_name)}/image/upload`,
      { method: "POST", body: uploadForm },
    );
    if (!uploadResponse.ok) {
      return null;
    }
    const result = (await uploadResponse.json()) as CloudinaryUploadResult;
    return result.secure_url ?? result.url ?? null;
  } catch {
    return null;
  }
}
