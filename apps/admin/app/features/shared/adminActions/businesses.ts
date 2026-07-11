import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { readBusinessOperationalStatus } from "../formReaders";
import {
  adminBusinessActionError,
} from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleBusinessesAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-business-status:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const operationalStatus = readBusinessOperationalStatus(
        form.get("operational_status"),
      );
      await adminApi.updateBusinessStatus(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          operationalStatus,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "businesses",
        severity: "success",
        message:
          operationalStatus === "suspended"
            ? "Business suspended."
            : "Business reactivated.",
      };
    } catch (error) {
      return {
        section: "businesses",
        severity: "error",
        message: adminBusinessActionError(error),
      };
    }
  }

  if (intent === "admin-customer:erase") {
    const { accessToken } = await requireAdminContext(request);
    try {
      const result = await adminApi.eraseCustomer(
        accessToken,
        String(form.get("customer_id") ?? ""),
        String(form.get("confirmation") ?? ""),
      );
      return {
        section: "customers",
        severity: "success",
        message: `Customer data erased. ${result.orders_retained} order(s) retained; ${result.measurements_cleared} measurement set(s) and ${result.booking_addresses_cleared} address(es) cleared.`,
      };
    } catch {
      return {
        section: "customers",
        severity: "error",
        message:
          "Could not erase this customer. Confirm you typed ERASE CUSTOMER DATA and have permission.",
      };
    }
  }

  return null;
}
