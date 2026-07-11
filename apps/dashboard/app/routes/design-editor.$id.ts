import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { apiFetch } from "../lib/auth";
import { uploadImage } from "../lib/media";

// Resource route backing the design editor's colour-variation and per-design
// size-band-override panels. The dashboard's API tokens live in an httpOnly
// cookie and never reach the browser, so the editor's fetcher hits this route
// (same-origin, cookie sent automatically) and it forwards to the protected
// /designs/{id}/... endpoints with the session's access token attached.
//
// GET returns the design's current variations and size-band overrides. POST
// dispatches on an `op` field to create/update/delete/reorder variations and to
// set/clear a size-band override. Image files are uploaded to Cloudinary here
// (same flow as the main design image upload) before the URLs are sent on.

type Variation = {
  variation_id: string;
  name: string;
  images: string[];
  is_default: boolean;
  sequence: number;
};

type SizeChartItem = { name: string; value: string; unit: string };

type SizeBandOverride = {
  size_band_id: string;
  label: string | null;
  chart: SizeChartItem[];
  chart_set: boolean;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// loadExtras reads the design's current variations and size-band overrides. The
// loader returns these, and each successful write returns the fresh set too so
// the editor re-renders from one response (no follow-up reload round trip).
async function loadExtras(
  request: Request,
  designID: string,
): Promise<{ variations: Variation[]; overrides: SizeBandOverride[] }> {
  const [variationsResponse, overridesResponse] = await Promise.all([
    apiFetch(request, `/designs/${encodeURIComponent(designID)}/variations`),
    apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}/size-band-overrides`,
    ),
  ]);

  const variations = variationsResponse.ok
    ? (((await variationsResponse.json()) as { variations?: Variation[] })
        .variations ?? [])
    : [];
  const overrides = overridesResponse.ok
    ? (((await overridesResponse.json()) as { overrides?: SizeBandOverride[] })
        .overrides ?? [])
    : [];

  return { variations, overrides };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const designID = String(params.id ?? "");
  if (!designID) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  return Response.json(await loadExtras(request, designID));
}

// parseImageURLs reads the kept-image URLs a multi-image field submits as a
// newline-joined hidden input.
function parseImageURLs(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
}

// uploadNewImages pushes each selected file to Cloudinary and returns the URLs.
// Returns null on any invalid/failed file so the caller can surface an error.
async function uploadNewImages(
  request: Request,
  files: File[],
): Promise<string[] | null> {
  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return null;
    }
    const url = await uploadImage(request, file);
    if (!url) {
      return null;
    }
    urls.push(url);
  }
  return urls;
}

function newFilesFrom(form: FormData): File[] {
  return form
    .getAll("image_files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

// variationWriteError maps the API's 409 codes to friendly messages so the
// editor can show an upgrade prompt when a plan cap is hit.
async function variationWriteError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (response.status === 409 && payload?.error === "variation_limit_reached") {
    return "variation_limit_reached";
  }
  if (response.status === 409 && payload?.error === "image_limit_exceeded") {
    return "image_limit_exceeded";
  }
  return payload?.error ?? "variation_write_failed";
}

export async function action({ request, params }: ActionFunctionArgs) {
  const designID = String(params.id ?? "");
  if (!designID) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const base = `/designs/${encodeURIComponent(designID)}`;
  const form = await request.formData();
  const op = String(form.get("op") ?? "");

  if (op === "create_variation" || op === "update_variation") {
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      return Response.json({ error: "name_required" }, { status: 400 });
    }
    const kept = parseImageURLs(form.get("image_urls"));
    const uploaded = await uploadNewImages(request, newFilesFrom(form));
    if (uploaded === null) {
      return Response.json({ error: "upload_failed" }, { status: 400 });
    }
    const images = [...kept, ...uploaded];
    const isCreate = op === "create_variation";
    const variationID = String(form.get("variation_id") ?? "").trim();
    if (!isCreate && !variationID) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }
    const response = await apiFetch(
      request,
      isCreate
        ? `${base}/variations`
        : `${base}/variations/${encodeURIComponent(variationID)}`,
      {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, images }),
      },
    );
    if (!response.ok) {
      const error = await variationWriteError(response);
      return Response.json({ error }, { status: response.status });
    }
    return Response.json({
      ok: true,
      ...(await loadExtras(request, designID)),
    });
  }

  if (op === "delete_variation") {
    const variationID = String(form.get("variation_id") ?? "").trim();
    if (!variationID) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }
    const response = await apiFetch(
      request,
      `${base}/variations/${encodeURIComponent(variationID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return Response.json(
        { error: "variation_write_failed" },
        { status: response.status },
      );
    }
    return Response.json({
      ok: true,
      ...(await loadExtras(request, designID)),
    });
  }

  if (op === "reorder_variations") {
    const orderedIDs = String(form.get("ordered_ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const response = await apiFetch(request, `${base}/variations/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordered_ids: orderedIDs }),
    });
    if (!response.ok) {
      return Response.json(
        { error: "variation_write_failed" },
        { status: response.status },
      );
    }
    return Response.json({
      ok: true,
      ...(await loadExtras(request, designID)),
    });
  }

  if (op === "set_override") {
    const bandID = String(form.get("band_id") ?? "").trim();
    if (!bandID) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }
    // A blank label inherits the master band's label; a present label overrides
    // it. The chart is included only when the row set is edited (chart_set), so
    // an untouched chart keeps inheriting the master.
    const label = String(form.get("label") ?? "").trim();
    const chartSet = form.get("chart_set") === "1";
    const body: { label?: string; chart?: SizeChartItem[] } = {};
    if (label) {
      body.label = label;
    }
    if (chartSet) {
      const names = form.getAll("chart_name");
      const values = form.getAll("chart_value");
      const units = form.getAll("chart_unit");
      const chart: SizeChartItem[] = [];
      for (let index = 0; index < names.length; index += 1) {
        const chartName = String(names[index] ?? "").trim();
        const chartValue = String(values[index] ?? "").trim();
        const chartUnit = String(units[index] ?? "").trim();
        if (chartName && chartValue) {
          chart.push({ name: chartName, value: chartValue, unit: chartUnit });
        }
      }
      body.chart = chart;
    }
    const response = await apiFetch(
      request,
      `${base}/size-bands/${encodeURIComponent(bandID)}/override`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      return Response.json(
        { error: "override_write_failed" },
        { status: response.status },
      );
    }
    return Response.json({
      ok: true,
      ...(await loadExtras(request, designID)),
    });
  }

  if (op === "clear_override") {
    const bandID = String(form.get("band_id") ?? "").trim();
    if (!bandID) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }
    const response = await apiFetch(
      request,
      `${base}/size-bands/${encodeURIComponent(bandID)}/override`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return Response.json(
        { error: "override_write_failed" },
        { status: response.status },
      );
    }
    return Response.json({
      ok: true,
      ...(await loadExtras(request, designID)),
    });
  }

  return Response.json({ error: "unknown_op" }, { status: 400 });
}
