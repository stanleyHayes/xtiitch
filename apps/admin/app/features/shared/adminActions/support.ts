import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { readSupportTicketStatus, readSupportAssignment } from "../formReaders";
import {
  adminSupportActionError,
  supportActionMessage,
} from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleSupportAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-support-ticket:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readSupportTicketStatus(form.get("status"));
    const assignment = readSupportAssignment(form.get("assignment"));

    try {
      await adminApi.updateSupportTicket(
        accessToken,
        String(form.get("ticket_key") ?? ""),
        {
          status,
          assignment,
          note: String(form.get("note") ?? ""),
        },
      );
      return {
        section: "support",
        severity: "success",
        message: supportActionMessage(status, assignment),
      };
    } catch (error) {
      return {
        section: "support",
        severity: "error",
        message: adminSupportActionError(error),
      };
    }
  }

  return null;
}
