import { Platform, Share } from "react-native";
import { authedFetch } from "./auth";

export type ReportKind = "financial" | "sales" | "full";
export type ReportFormat = "csv" | "pdf" | "docx" | "xlsx";

export async function exportReport(
  kind: ReportKind,
  format: ReportFormat,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await authedFetch(
      `/reports/${kind}?format=${encodeURIComponent(format)}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        message:
          response.status === 403
            ? "This report or format is not included in your current plan."
            : "The report could not be prepared right now.",
      };
    }
    const blob = await response.blob();
    const filename = `xtiitch-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`;
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return { ok: true };
    }
    const url = await blobDataUrl(blob);
    await Share.share({ title: filename, url });
    return { ok: true };
  } catch {
    return { ok: false, message: "The report could not be downloaded." };
  }
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
