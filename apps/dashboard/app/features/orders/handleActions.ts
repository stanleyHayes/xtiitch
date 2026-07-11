import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import { safeDashboardReturn } from "../shared/api";
import { parseMoneyMinor } from "../shared/utils";
import { extractMeasurementValues } from "../settings/utils";

export async function handleOrdersActions( // eslint-disable-line complexity, max-lines-per-function -- intent dispatcher with many conditional branches; refactor in follow-up
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "advance") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID) {
      return { orderError: "That order cannot move stages yet." };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/advance`,
      { method: "POST" },
    );
    if (!response.ok) {
      return { orderError: "That order cannot move stages yet." };
    }
    return redirect(returnTo);
  }

if (intent === "record_measurements") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const source = String(form.get("source") ?? "").trim();
    const values = extractMeasurementValues(form);
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID || !source || Object.keys(values).length === 0) {
      return {
        measurementError: "Add at least one measurement value before saving.",
      };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/measurements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, values }),
      },
    );
    if (!response.ok) {
      return {
        measurementError:
          "Could not save those measurements. Check the order route and field list.",
      };
    }
    return redirect(returnTo);
  }

if (intent === "create_walk_in_order") {
    const designID = String(form.get("design_id") ?? "").trim();
    const sizeBandID = String(form.get("size_band_id") ?? "").trim();
    const customerName = String(form.get("customer_name") ?? "").trim();
    const agreedTotalMinor = parseMoneyMinor(form.get("agreed_total_ghs"));
    if (!designID || !customerName) {
      return {
        walkInError:
          "Choose a design and add the customer name before logging a walk-in order.",
      };
    }
    const response = await apiFetch(request, "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        design_id: designID,
        size_band_id: sizeBandID || undefined,
        customer_name: customerName,
        customer_phone: String(form.get("customer_phone") ?? "").trim(),
        customer_email: String(form.get("customer_email") ?? "").trim(),
        agreed_total_minor: agreedTotalMinor,
      }),
    });
    if (!response.ok) {
      return {
        walkInError:
          "Could not log that walk-in order. Check the design, size, and customer details.",
      };
    }
    return redirect("/dashboard/orders?orders=confirmed");
  }

if (intent === "create_custom_walk_in_order") {
    const designID = String(form.get("design_id") ?? "").trim();
    const customerName = String(form.get("customer_name") ?? "").trim();
    if (!designID || !customerName) {
      return {
        walkInError:
          "Choose a design and add the customer name before logging a bespoke order.",
      };
    }
    // Measurement fields are posted as m_<field_id>; collect the non-empty ones
    // into the measurements map the API validates against the business's fields.
    const measurements: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (key.startsWith("m_") && typeof value === "string" && value.trim()) {
        measurements[key.slice(2)] = value.trim();
      }
    }
    const response = await apiFetch(request, "/orders/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        design_id: designID,
        customer_name: customerName,
        customer_phone: String(form.get("customer_phone") ?? "").trim(),
        customer_email: String(form.get("customer_email") ?? "").trim(),
        measurements,
      }),
    });
    if (!response.ok) {
      return {
        walkInError:
          "Could not log that bespoke order. Bespoke needs a bespoke stage configured for your studio.",
      };
    }
    return redirect("/dashboard/orders?orders=confirmed");
  }

if (intent === "set_agreed_total") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const agreedTotalMinor = parseMoneyMinor(form.get("agreed_total_ghs"));
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID || agreedTotalMinor === null) {
      return { orderError: "Add a valid agreed total before saving." };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/agreed-total`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed_total_minor: agreedTotalMinor }),
      },
    );
    if (!response.ok) {
      return { orderError: "Could not save that agreed total." };
    }
    return redirect(returnTo);
  }

if (intent === "collect_balance") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const method =
      String(form.get("method") ?? "momo") === "card" ? "card" : "momo";
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID) {
      return { orderError: "Choose an order before collecting a balance." };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/balance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      },
    );
    if (!response.ok) {
      return {
        orderError:
          "Could not open balance checkout. The order may already be paid or payment may be in progress.",
      };
    }
    const payload = (await response.json()) as {
      authorization_url?: string;
    };
    if (payload.authorization_url) {
      return redirect(payload.authorization_url);
    }
    return redirect(returnTo);
  }
  return null;
}
