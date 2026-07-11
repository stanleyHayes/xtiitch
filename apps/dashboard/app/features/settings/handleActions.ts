import { apiFetch } from "../../lib/auth";
import { tokens } from "../../theme";
import { uploadDesignImage } from "../studio/utils";

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
        fee_pass_to_buyer: form.get("fee_pass_to_buyer") === "on",
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
    const cardNumber = String(form.get("card_number") ?? "").trim();
    if (!cardNumber) {
      return { verificationError: "Enter your Ghana Card number." };
    }
    // The photo is uploaded to Cloudinary first (same path as logos/designs);
    // the API stores the resulting URL and moves the business to 'pending'.
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
        verificationError: "Upload a clear photo of your Ghana Card.",
      };
    }
    const response = await apiFetch(
      request,
      "/auth/business/identity-verification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cardNumber,
          id_photo_url: photoURL,
        }),
      },
    );
    if (!response.ok) {
      return {
        verificationError:
          "Could not submit your verification. Check the details and try again.",
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
    // both and marks the business verified.
    const settlementAccount = String(form.get("settlement_account") ?? "").trim();
    const settlementBank = String(form.get("settlement_bank") ?? "").trim();
    if (!settlementAccount || !settlementBank) {
      return {
        payoutError:
          "Choose your mobile money network and enter the number payouts should go to.",
      };
    }
    const response = await apiFetch(request, "/businesses/me/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settlement_account: settlementAccount,
        settlement_bank: settlementBank,
      }),
    });
    if (!response.ok) {
      return {
        payoutError:
          "Could not save those payout details. Check the number and try again.",
      };
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
