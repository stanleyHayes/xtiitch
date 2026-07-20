import { apiFetch } from "../../lib/auth";
import { apiErrorCode } from "../shared/utils";
import { isValidGhanaCardNumber } from "../../lib/ghana-card";
import { tokens } from "../../theme";
import { uploadDesignImage } from "../studio/utils";

// Turn the API's payout error codes into something the owner can act on. Each
// case implies a different next step — retype the code, request a fresh one,
// wait, fix the number, or verify the business first — so they must not
// collapse into one message.
async function payoutErrorMessage(response: Response): Promise<string> {
  const code = await apiErrorCode(response);
  switch (code) {
    case "invalid_code":
      return "That code doesn't match. Check it and try again.";
    case "code_expired":
      return "That code has expired. Send a new one to your number.";
    case "too_many_attempts":
      return "Too many incorrect codes. Send a new one to try again.";
    case "resend_too_soon":
      return "A code was just sent to that number. Wait a minute, then retry.";
    case "invalid_phone":
      return "That doesn't look like a Ghana mobile money number.";
    case "invalid_payout_number":
      // §2.1: exactly 10 local digits — the same rule the form checks
      // client-side, surfaced when the API is the one that catches it.
      return "Enter the MoMo number in its 10-digit local form (e.g. 0240000000).";
    case "identity_verification_required":
      // §2.2: payout setup before admin-approved Ghana Card verification. The
      // panel normally hides the form in this state; this is the fallback.
      return "Complete your Ghana Card business verification first — payout details unlock after an admin approves it.";
    case "delivery_failed":
      return "We couldn't deliver the code to that number. Check it and retry.";
    case "whatsapp_unavailable":
      return "Number verification is unavailable right now. Try again shortly.";
    case "forbidden":
      return "You don't have permission to change payout details.";
    default:
      return "Could not save those payout details. Check the number and try again.";
  }
}

export async function handleSettingsActions( // eslint-disable-line complexity, max-lines-per-function -- intent dispatcher with many conditional branches; refactor in follow-up
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "save_store_settings") {
    const brandColor = String(form.get("brand_color") ?? "").trim();
    // Logo + banner are uploaded from disk to Cloudinary; when no new file is
    // chosen the previously-saved URL is preserved. The API re-checks plan
    // entitlements and coerces anything ungranted back to defaults.
    let logoURL = String(form.get("logo_url_existing") ?? "").trim();
    const logoFile = form.get("logo_file");
    if (logoFile instanceof File && logoFile.size > 0) {
      const uploaded = await uploadDesignImage(request, logoFile);
      if (uploaded) {
        logoURL = uploaded;
      }
    }
    let bannerURL = String(form.get("banner_url_existing") ?? "").trim();
    const bannerFile = form.get("banner_file");
    if (bannerFile instanceof File && bannerFile.size > 0) {
      const uploaded = await uploadDesignImage(request, bannerFile);
      if (uploaded) {
        bannerURL = uploaded;
      }
    }
    const response = await apiFetch(request, "/store-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bespoke_enabled: form.get("bespoke_enabled") === "on",
        measurements_enabled: form.get("measurements_enabled") === "on",
        customisation_enabled: form.get("customisation_enabled") === "on",
        collections_enabled: form.get("collections_enabled") === "on",
        delivery_enabled: form.get("delivery_enabled") === "on",
        dispatch_enabled: form.get("dispatch_enabled") === "on",
        // §4.4: three independent pass-down controls (all default off — the
        // owner absorbs the fees). fee_pass_to_buyer is gone.
        fee_pass_xtiitch_fee: form.get("fee_pass_xtiitch_fee") === "on",
        fee_pass_tax: form.get("fee_pass_tax") === "on",
        fee_pass_paystack_fee: form.get("fee_pass_paystack_fee") === "on",
        brand_color: brandColor || tokens.burgundy,
        logo_url: logoURL,
        banner_url: bannerURL,
        layout_variant: String(form.get("layout_variant") ?? "standard").trim(),
      }),
    });
    if (!response.ok) {
      return {
        settingsError:
          "Could not save storefront settings. Check the brand colour and feature switches.",
      };
    }
    return { settingsSuccess: "Storefront settings saved." };
  }

if (intent === "create_delivery_zone" || intent === "update_delivery_zone") {
    const name = String(form.get("name") ?? "").trim();
    // The business enters a fee in GHS; store it in minor units (pesewas).
    const feeMajor = Number(String(form.get("fee") ?? "").trim());
    if (!name || !Number.isFinite(feeMajor) || feeMajor < 0) {
      return { settingsError: "Enter a zone name and a valid delivery fee." };
    }
    const feeMinor = Math.round(feeMajor * 100);
    const sequence = Number(String(form.get("sequence") ?? "0").trim()) || 0;
    if (intent === "create_delivery_zone") {
      const response = await apiFetch(request, "/delivery-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, fee_minor: feeMinor, sequence }),
      });
      if (!response.ok) {
        return {
          settingsError:
            response.status === 409
              ? "A delivery zone with that name already exists."
              : "Could not add that delivery zone.",
        };
      }
      return { settingsSuccess: "Delivery zone added." };
    }
    const zoneID = String(form.get("zone_id") ?? "").trim();
    if (!zoneID) {
      return { settingsError: "That delivery zone could not be found." };
    }
    const response = await apiFetch(
      request,
      `/delivery-zones/${encodeURIComponent(zoneID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          fee_minor: feeMinor,
          sequence,
          active: form.get("active") === "on",
        }),
      },
    );
    if (!response.ok) {
      return {
        settingsError:
          response.status === 409
            ? "A delivery zone with that name already exists."
            : "Could not update that delivery zone.",
      };
    }
    return { settingsSuccess: "Delivery zone updated." };
  }

if (intent === "delete_delivery_zone") {
    const zoneID = String(form.get("zone_id") ?? "").trim();
    if (!zoneID) {
      return { settingsError: "That delivery zone could not be found." };
    }
    const response = await apiFetch(
      request,
      `/delivery-zones/${encodeURIComponent(zoneID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return { settingsError: "Could not remove that delivery zone." };
    }
    return { settingsSuccess: "Delivery zone removed." };
  }

if (intent === "submit_identity_verification") {
    // §2.3: the owner's official name exactly as printed on the Ghana Card —
    // required by the API (400 invalid_input when blank).
    const fullLegalName = String(form.get("full_legal_name") ?? "").trim();
    if (!fullLegalName) {
      return {
        verificationError:
          "Enter your full legal name exactly as it appears on your Ghana Card.",
      };
    }
    if (fullLegalName.length > 200) {
      return {
        verificationError: "That name is too long. Use the name on your Ghana Card.",
      };
    }
    const cardNumber = String(form.get("card_number") ?? "").trim();
    // Server-side re-check of the §2.3 format lock; the field formats as the
    // owner types, but a bypassed client check must still not save garbage.
    if (!isValidGhanaCardNumber(cardNumber)) {
      return {
        verificationError:
          "Enter your Ghana Card number in the exact format GHA-123456789-0.",
      };
    }
    // Both photos are uploaded to Cloudinary first (same path as logos/designs);
    // the API stores the resulting URLs and moves the business to 'pending'.
    let photoURL = String(form.get("id_photo_url_existing") ?? "").trim();
    const photoFile = form.get("id_photo_file");
    if (photoFile instanceof File && photoFile.size > 0) {
      const uploaded = await uploadDesignImage(request, photoFile);
      if (uploaded) {
        photoURL = uploaded;
      }
    }
    if (!photoURL) {
      return {
        verificationError: "Upload a clear photo of the front of your Ghana Card.",
      };
    }
    let photoBackURL = String(
      form.get("id_photo_back_url_existing") ?? "",
    ).trim();
    const photoBackFile = form.get("id_photo_back_file");
    if (photoBackFile instanceof File && photoBackFile.size > 0) {
      const uploaded = await uploadDesignImage(request, photoBackFile);
      if (uploaded) {
        photoBackURL = uploaded;
      }
    }
    if (!photoBackURL) {
      return {
        verificationError: "Upload a clear photo of the back of your Ghana Card.",
      };
    }
    const response = await apiFetch(
      request,
      "/auth/business/identity-verification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_legal_name: fullLegalName,
          card_number: cardNumber,
          id_photo_url: photoURL,
          id_photo_back_url: photoBackURL,
        }),
      },
    );
    if (!response.ok) {
      return {
        verificationError:
          "Could not submit your verification. Check the name, card number (format GHA-123456789-0) and photos, then try again.",
      };
    }
    return {
      verificationSuccess:
        "Verification submitted. We'll review your Ghana Card shortly.",
    };
  }

if (intent === "setup_payout") {
    // The settlement account is the MoMo number payouts are sent to, and the
    // settlement bank is its network (MTN / VOD / ATL) — Paystack requires the
    // network code to create the payout subaccount. /businesses/me/verify records
    // them plus the MoMo-registered account name (§2.1: it becomes the
    // subaccount's business name) and answers {"payout_status":"ready"} — a
    // payout state, NOT a verification (§2.2).
    const settlementAccount = String(form.get("settlement_account") ?? "").trim();
    const settlementBank = String(form.get("settlement_bank") ?? "").trim();
    const settlementAccountName = String(
      form.get("settlement_account_name") ?? "",
    ).trim();
    const otpCode = String(form.get("otp_code") ?? "").trim();
    if (!settlementAccount || !settlementBank) {
      return {
        payoutError:
          "Choose your mobile money network and enter the number payouts should go to.",
      };
    }
    if (!settlementAccountName) {
      return {
        payoutError:
          "Enter the exact legal name registered on this MoMo number.",
      };
    }
    const response = await apiFetch(request, "/businesses/me/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settlement_account: settlementAccount,
        settlement_bank: settlementBank,
        settlement_account_name: settlementAccountName,
        otp_code: otpCode,
      }),
    });
    if (!response.ok) {
      // The API distinguishes a wrong code from an expired one from a lockout.
      // Collapsing them into one message would leave the owner retrying the same
      // dead code, so each maps to the action it actually calls for.
      return { payoutError: await payoutErrorMessage(response) };
    }
    return {
      payoutSuccess: "Payout details saved. You're set to receive settlements.",
    };
  }

if (intent === "update_waitlist_status") {
    const entryId = String(form.get("entry_id") ?? "").trim();
    const status = String(form.get("status") ?? "").trim();
    const response = await apiFetch(
      request,
      `/waitlist-entries/${encodeURIComponent(entryId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!response.ok) {
      return { settingsError: "Could not update that waiting-list entry." };
    }
    return { settingsSuccess: "Waiting-list entry updated." };
  }
  return null;
}
