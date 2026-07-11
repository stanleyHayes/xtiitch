import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import { datetimeLocalToRFC3339 } from "../shared/utils";
import { parseAvailabilityWindows } from "../settings/utils";

export async function handleAvailabilityActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "cancel_booking") {
    const bookingID = String(form.get("booking_id") ?? "").trim();
    if (!bookingID) {
      return { bookingError: "That booking could not be found." };
    }
    const response = await apiFetch(
      request,
      `/bookings/${encodeURIComponent(bookingID)}/cancel`,
      { method: "POST" },
    );
    if (!response.ok) {
      return {
        bookingError:
          "Could not cancel that booking. It may already be closed.",
      };
    }
    return redirect("/dashboard/visits");
  }

if (intent === "reschedule_booking") {
    const bookingID = String(form.get("booking_id") ?? "").trim();
    const slotStart = datetimeLocalToRFC3339(
      String(form.get("slot_start") ?? ""),
    );
    if (!bookingID || !slotStart) {
      return { bookingError: "Pick a valid new visit time." };
    }
    const response = await apiFetch(
      request,
      `/bookings/${encodeURIComponent(bookingID)}/reschedule`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_start: slotStart }),
      },
    );
    if (!response.ok) {
      return {
        bookingError:
          "Could not reschedule that visit. The slot may be unavailable.",
      };
    }
    return redirect("/dashboard/visits");
  }

if (intent === "arrange_handover") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const method = String(form.get("method") ?? "").trim();
    if (!orderID || !method) {
      return { handoverError: "Select a fulfilled order and handover method." };
    }
    const response = await apiFetch(request, "/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderID,
        method,
        recipient_name: String(form.get("recipient_name") ?? "").trim(),
        recipient_phone: String(form.get("recipient_phone") ?? "").trim(),
        address: String(form.get("address") ?? "").trim(),
        courier: String(form.get("courier") ?? "").trim(),
        note: String(form.get("note") ?? "").trim(),
      }),
    });
    if (!response.ok) {
      return {
        handoverError:
          "Could not arrange that handover. The order may not be fulfilled yet.",
      };
    }
    return redirect("/dashboard/handovers");
  }

if (intent === "advance_handover") {
    const handoverID = String(form.get("handover_id") ?? "").trim();
    if (!handoverID) {
      return { handoverError: "That handover could not be found." };
    }
    const response = await apiFetch(
      request,
      `/handovers/${encodeURIComponent(handoverID)}/advance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courier: String(form.get("courier") ?? "").trim(),
          note: String(form.get("note") ?? "").trim(),
        }),
      },
    );
    if (!response.ok) {
      return {
        handoverError:
          "Could not move that handover. It may already be closed.",
      };
    }
    return redirect("/dashboard/handovers");
  }

if (intent === "cancel_handover") {
    const handoverID = String(form.get("handover_id") ?? "").trim();
    if (!handoverID) {
      return { handoverError: "That handover could not be found." };
    }
    const response = await apiFetch(
      request,
      `/handovers/${encodeURIComponent(handoverID)}/cancel`,
      { method: "POST" },
    );
    if (!response.ok) {
      return {
        handoverError:
          "Could not cancel that handover. It may already be closed.",
      };
    }
    return redirect("/dashboard/handovers");
  }

if (intent === "save_availability") {
    const windows = parseAvailabilityWindows(form);
    if (windows === null) {
      return {
        availabilityError:
          "Check the weekday, start time, end time, and slot length for each row.",
      };
    }
    const response = await apiFetch(request, "/availability/windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows }),
    });
    if (!response.ok) {
      return {
        availabilityError:
          "Could not save those hours. Avoid overlapping windows and use valid times.",
      };
    }
    return { availabilitySuccess: "Visit hours saved." };
  }

if (intent === "mark_blackout") {
    const date = String(form.get("date") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { availabilityError: "Pick a valid day to block out." };
    }
    const response = await apiFetch(request, "/availability/blackouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (!response.ok) {
      return {
        availabilityError: "Could not block out that day. Try again.",
      };
    }
    return { availabilitySuccess: "Day blocked out." };
  }

if (intent === "clear_blackout") {
    const date = String(form.get("date") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { availabilityError: "That blocked-out day could not be found." };
    }
    const response = await apiFetch(
      request,
      `/availability/blackouts/${encodeURIComponent(date)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return {
        availabilityError: "Could not reopen that day. Try again.",
      };
    }
    return { availabilitySuccess: "Day reopened." };
  }
  return null;
}
