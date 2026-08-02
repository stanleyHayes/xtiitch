import * as ImagePicker from "expo-image-picker";
import { request } from "./businessApi";

type UploadSignature = {
  signature: string;
  timestamp: number;
  cloud_name: string;
  api_key: string;
  folder: string;
};

export async function pickAndUploadDesignImage(): Promise<
  | { ok: true; url: string }
  | { ok: false; error: "cancelled" | "permission" | "upload" }
> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { ok: false, error: "permission" };
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.86,
  });
  if (picked.canceled || !picked.assets[0]) {
    return { ok: false, error: "cancelled" };
  }
  const signature = await request<UploadSignature>(
    "/media/design-upload-signature",
    { method: "POST" },
  );
  if (!signature.ok || signature.data.cloud_name === "demo") {
    return { ok: false, error: "upload" };
  }
  try {
    const asset = picked.assets[0];
    const blob = await (await fetch(asset.uri)).blob();
    const form = new FormData();
    form.append("file", blob, asset.fileName ?? `design-${Date.now()}.jpg`);
    form.append("api_key", signature.data.api_key);
    form.append("timestamp", String(signature.data.timestamp));
    form.append("signature", signature.data.signature);
    if (signature.data.folder) form.append("folder", signature.data.folder);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.data.cloud_name)}/image/upload`,
      { method: "POST", body: form },
    );
    if (!response.ok) return { ok: false, error: "upload" };
    const result = (await response.json()) as { secure_url?: string };
    return result.secure_url
      ? { ok: true, url: result.secure_url }
      : { ok: false, error: "upload" };
  } catch {
    return { ok: false, error: "upload" };
  }
}
