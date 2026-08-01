import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import type { Design } from "../../lib/api";
import {
  parseSequence,
  parseDepositMinor,
  parseMoneyMinor,
  parseOptionalMoneyMinor,
  parseImageURLs,
} from "../shared/utils";
import {
  designPatchBody,
  designWriteErrorMessage,
  uploadDesignImage,
} from "./utils";
import {
  MAX_UPLOAD_BUDGET_BYTES,
  MAX_UPLOAD_BUDGET_MB,
} from "../../lib/upload-limits";

// Backstop for the browser-side resize in use-image-upload-field.ts. A request
// this large normally never reaches the action — Vercel refuses it at 4.5 MB
// first — so this catches the paths the dropzone cannot: scripted posts and
// browsers where the resize could not run. The message names the same limit the
// field's label quotes so the two never disagree.
function oversizeImageError(files: readonly File[]): string | null {
  let total = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return "Upload image files such as JPG, PNG, or WebP.";
    }
    total += file.size;
    if (file.size > MAX_UPLOAD_BUDGET_BYTES || total > MAX_UPLOAD_BUDGET_BYTES) {
      return `That upload is too large — one upload can carry ${MAX_UPLOAD_BUDGET_MB} MB in total. Add fewer images at a time, or export smaller copies.`;
    }
  }
  return null;
}

// Creates the colour variations collected on the add-design form, in order.
//
// The API creates a variation against an existing design, so this can only run
// after the design has been created — which is why the owner filling it all in
// on one screen still becomes several requests behind the scenes. That is also
// the better shape on a weak connection: several small requests beat one large
// body that the network drops.
//
// Returns a message on the first failure. The design is already saved by then,
// so the message must say that rather than implying the whole save was lost.
async function createVariations(
  request: Request,
  designID: string,
  form: FormData,
): Promise<string | null> {
  if (!designID) {
    return null;
  }
  for (let index = 0; ; index += 1) {
    const name = String(form.get(`variation_name_${index}`) ?? "").trim();
    if (!name) {
      // Rows are emitted with contiguous indexes, so the first gap is the end.
      break;
    }
    const files = form
      .getAll(`variation_images_${index}`)
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const oversize = oversizeImageError(files);
    if (oversize) {
      return `"${name}" was not added: ${oversize}`;
    }

    const images: string[] = [];
    for (const file of files) {
      const url = await uploadDesignImage(request, file);
      if (!url) {
        return `The design was saved, but "${name}" could not be added — one of its images failed to upload. Add it from the design editor.`;
      }
      images.push(url);
    }

    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}/variations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, images }),
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (payload?.error === "variation_limit_reached") {
        return `The design was saved, but "${name}" exceeds the variations your plan allows. Upgrade, or add it from the design editor.`;
      }
      return `The design was saved, but "${name}" could not be added. Add it from the design editor.`;
    }
  }
  return null;
}

export async function handleStudioActions( // eslint-disable-line complexity, max-lines-per-function -- intent dispatcher with many conditional branches; refactor in follow-up
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
  if (intent === "upload_design_image") {
    const designID = String(form.get("design_id") ?? "").trim();
    const file = form.get("image_file");
    if (!designID) {
      return { mediaError: "Choose a design before uploading an image." };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { mediaError: "Choose an image file before uploading." };
    }
    const oversize = oversizeImageError([file]);
    if (oversize) {
      return { mediaError: oversize };
    }

    const designResponse = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
    );
    if (!designResponse.ok) {
      return { mediaError: "That design could not be found." };
    }
    const design = (await designResponse.json()) as Design;
    const imageUrl = await uploadDesignImage(request, file);
    if (!imageUrl) {
      return {
        mediaError:
          "Could not upload that image. Check Cloudinary setup or try another file.",
      };
    }

    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          designPatchBody(design, [
            imageUrl,
            ...design.images.filter((url) => url !== imageUrl),
          ]),
        ),
      },
    );
    if (!response.ok) {
      return {
        mediaError: "Image uploaded, but the design could not be saved.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "update_design") {
    const designID = String(form.get("design_id") ?? "").trim();
    const sequence = parseSequence(form.get("sequence"));
    const depositOverrideMinor = parseDepositMinor(form.get("deposit_ghs"));
    // Indicative "from" price for a bespoke design (pesewas); 0 when cleared.
    const bespokeDisplayMinor =
      parseOptionalMoneyMinor(form.get("bespoke_display_ghs")) ?? 0;
    if (!designID || sequence === null) {
      return {
        designError: "Could not update that design. Check the display order.",
      };
    }
    // Kept images (the owner may have removed some) plus any newly uploaded
    // files. New files are sent to Cloudinary and appended; the API enforces the
    // per-plan image cap and returns image_limit_exceeded if exceeded.
    const keptImages = parseImageURLs(form.get("image_urls"));
    const newFiles = form
      .getAll("image_files")
      .filter(
        (entry): entry is File => entry instanceof File && entry.size > 0,
      );
    const newFilesOversize = oversizeImageError(newFiles);
    if (newFilesOversize) {
      return { designError: newFilesOversize };
    }
    const uploaded: string[] = [];
    for (const file of newFiles) {
      const url = await uploadDesignImage(request, file);
      if (url) {
        uploaded.push(url);
      }
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: String(form.get("collection_id") ?? "").trim() || null,
          title: String(form.get("title") ?? "").trim(),
          description: String(form.get("description") ?? "").trim(),
          style_category: String(form.get("style_category") ?? "").trim(),
          customisation_allowed: form.get("customisation") === "on",
          deposit_override_minor: depositOverrideMinor,
          bespoke_display_minor: bespokeDisplayMinor,
          sequence,
          images: [...keptImages, ...uploaded],
        }),
      },
    );
    if (!response.ok) {
      return { designError: await designWriteErrorMessage(response) };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "set_design_price") {
    const designID = String(form.get("design_id") ?? "").trim();
    const sizeBandID = String(form.get("size_band_id") ?? "").trim();
    const priceMinor = parseMoneyMinor(form.get("price_ghs"));
    if (!designID || !sizeBandID || priceMinor === null) {
      return { priceError: "Choose a design, size, and valid price." };
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}/prices/${encodeURIComponent(sizeBandID)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_minor: priceMinor }),
      },
    );
    if (!response.ok) {
      return { priceError: "Could not save that design price." };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "create") {
    const sequence = parseSequence(form.get("sequence"));
    const depositOverrideMinor = parseDepositMinor(form.get("deposit_ghs"));
    const bespokeDisplayMinor =
      parseOptionalMoneyMinor(form.get("bespoke_display_ghs")) ?? 0;
    const requestedImageLimit = Number.parseInt(
      String(form.get("image_limit") ?? ""),
      10,
    );
    // Absent or unparseable means the plan is uncapped. This used to fall back
    // to 5, a copy of a constant the API no longer holds: once a plan can be
    // given any cap from the admin matrix, that fallback would block an uncapped
    // merchant at 5 with a message citing a limit nothing enforces.
    //
    // Zero is a REAL cap, not a missing one: the mirror writes 0 for a withheld
    // entitlement, and the API rejects every image at 0. Accepting it only when
    // `> 0` would read "no images allowed" as "unlimited" — the same inversion,
    // in the opposite direction, that the mirror's CASE exists to prevent.
    const imageLimit = Number.isFinite(requestedImageLimit)
      ? Math.max(requestedImageLimit, 0)
      : null;

    // Catalogue images are uploaded from the user's device to Cloudinary (no
    // link pasting); only the resulting URLs are stored. The API still enforces
    // the authoritative plan cap, but checking here avoids wasteful uploads.
    const legacyFile = form.get("image_file");
    const imageFiles = form
      .getAll("image_files")
      .filter((file): file is File => file instanceof File && file.size > 0);
    if (
      legacyFile instanceof File &&
      legacyFile.size > 0 &&
      imageFiles.length === 0
    ) {
      imageFiles.push(legacyFile);
    }
    if (imageLimit !== null && imageFiles.length > imageLimit) {
      return {
        designError: `You can upload up to ${imageLimit} images on your plan.`,
      };
    }
    const imageFilesOversize = oversizeImageError(imageFiles);
    if (imageFilesOversize) {
      return { designError: imageFilesOversize };
    }
    const images: string[] = [];
    for (const file of imageFiles) {
      const imageUrl = await uploadDesignImage(request, file);
      if (!imageUrl) {
        return {
          designError:
            "Could not upload that image. Check Cloudinary setup or try another file.",
        };
      }
      images.push(imageUrl);
    }
    const customisationAllowed = form.get("customisation") === "on";

    const response = await apiFetch(request, "/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_id: String(form.get("collection_id") ?? "").trim() || null,
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        style_category: String(form.get("style_category") ?? "").trim(),
        customisation_allowed: customisationAllowed,
        deposit_override_minor: depositOverrideMinor,
        bespoke_display_minor: bespokeDisplayMinor,
        sequence: sequence ?? 0,
        images,
      }),
    });
    if (!response.ok) {
      return {
        designError: await designWriteErrorMessage(response),
      };
    }
    const created = (await response.json()) as { design_id?: string };
    const designID = created.design_id ?? "";
    if (designID && !customisationAllowed) {
      for (const [key, value] of form.entries()) {
        if (!key.startsWith("price_ghs_")) {
          continue;
        }
        const priceMinor = parseMoneyMinor(value);
        const sizeBandID = key.slice("price_ghs_".length);
        if (!sizeBandID || priceMinor === null) {
          continue;
        }
        await apiFetch(
          request,
          `/designs/${encodeURIComponent(designID)}/prices/${encodeURIComponent(sizeBandID)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price_minor: priceMinor }),
          },
        );
      }
    }
    const variationError = await createVariations(request, designID, form);
    if (variationError) {
      // The design itself exists — say so plainly rather than implying nothing
      // was saved, and name the variation that failed so it can be added from
      // the editor without redoing the whole design.
      return { designError: variationError };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "delete_design") {
    const designID = String(form.get("id") ?? "").trim();
    if (!designID) {
      return { designError: "That design could not be found." };
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return { designError: "Could not remove that design." };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "retire" || intent === "restore") {
    const designID = String(form.get("id") ?? "").trim();
    if (!designID) {
      return { designError: "That design could not be found." };
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}/${intent}`,
      { method: "POST" },
    );
    if (!response.ok) {
      return { designError: "Could not update that design status." };
    }
    return redirect("/dashboard/catalogue");
  }
  return null;
}
