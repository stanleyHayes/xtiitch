import { apiFetch } from "../../lib/auth";
import type { Design } from "../../lib/api";
import { UploadSignature, CloudinaryUploadResult } from "../shared/types";
import { apiErrorCode } from "../shared/utils";

export async function designWriteErrorMessage(response: Response): Promise<string> {
  const code = await apiErrorCode(response);
  if (code === "image_limit_exceeded") {
    return "You've reached your plan's image limit. Upgrade your plan to add more images per design.";
  }
  if (code === "plan_limit_exceeded") {
    return "You've reached your plan's design limit. Upgrade your plan to add more designs.";
  }
  if (code === "pricing_mode_conflict") {
    return "Switch this design to made-to-wear before setting size-band prices.";
  }
  return "Could not update that design. Check the title, images, deposit, and collection.";
}

export async function uploadDesignImage(
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
  const signature = (await signatureResponse.json()) as UploadSignature;
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
}

export function designPatchBody(
  design: Design,
  images: string[],
): Record<string, unknown> {
  return {
    collection_id: design.collection_id,
    title: design.title,
    description: design.description,
    customisation_allowed: design.customisation_allowed,
    deposit_override_minor: design.deposit_override_minor,
    sequence: design.sequence,
    images,
  };
}