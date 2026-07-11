import { adminApi } from "../../../lib/api";
import { requireAdminContext, logOut } from "../../../lib/session";
import {
  readAdminExportDataset,
  adminExportFilename,
} from "../formReaders";
import type { AdminActionFeedback } from "../types";

export async function handleAuthAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | Response | null> {
  if (intent === "logout") {
    return logOut(request);
  }

  if (intent === "admin-export:download") {
    const { accessToken } = await requireAdminContext(request);
    const dataset = readAdminExportDataset(form.get("dataset"));
    const csv = await adminApi.exportDataset(accessToken, dataset);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${adminExportFilename(
          dataset,
        )}"`,
      },
    });
  }

  return null;
}
