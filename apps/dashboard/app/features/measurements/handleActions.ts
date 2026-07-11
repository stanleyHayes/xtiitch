import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import { parseSequence } from "../shared/utils";

export async function handleMeasurementsActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "create_measurement_field") {
    const sequence = parseSequence(form.get("sequence"));
    if (sequence === null) {
      return {
        fieldError: "Use a zero or positive display order for the field.",
      };
    }
    const response = await apiFetch(request, "/measurement-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: String(form.get("label") ?? "").trim(),
        unit: String(form.get("unit") ?? "in").trim(),
        sequence,
      }),
    });
    if (!response.ok) {
      return {
        fieldError:
          "Could not add the field. Check the label and display order.",
      };
    }
    return redirect("/dashboard/measurements");
  }

if (intent === "update_measurement_field") {
    const fieldID = String(form.get("field_id") ?? "").trim();
    const sequence = parseSequence(form.get("sequence"));
    if (!fieldID || sequence === null) {
      return {
        fieldError: "Could not update that field. Check the display order.",
      };
    }
    const response = await apiFetch(
      request,
      `/measurement-fields/${encodeURIComponent(fieldID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(form.get("label") ?? "").trim(),
          unit: String(form.get("unit") ?? "in").trim(),
          sequence,
        }),
      },
    );
    if (!response.ok) {
      return {
        fieldError:
          "Could not update that field. Another field may already use that order.",
      };
    }
    return redirect("/dashboard/measurements");
  }

if (intent === "delete_measurement_field") {
    const fieldID = String(form.get("field_id") ?? "").trim();
    if (!fieldID) {
      return { fieldError: "Could not delete that field." };
    }
    const response = await apiFetch(
      request,
      `/measurement-fields/${encodeURIComponent(fieldID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return { fieldError: "Could not delete that field." };
    }
    return redirect("/dashboard/measurements");
  }
  return null;
}
