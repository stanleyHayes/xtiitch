// Imported into the client bundle (SponsoredRail), so never touch `process` at
// import time in the browser; the API calls only run server-side anyway.
const readEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env[key] : undefined;

const API_BASE = readEnv("XTIITCH_API_URL") ?? "http://localhost:8080";

export type SponsoredPlacement = {
  campaignId: string;
  businessId: string;
  businessName: string;
  businessHandle: string;
  placementType: "featured_business" | "promoted_design" | "homepage_hero";
  targetLabel: string;
  headline: string;
  description: string;
  storeHandle: string;
  designHandle: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  href: string;
};

type SponsoredPlacementPayload = {
  campaign_id: string;
  business_id: string;
  business_name: string;
  business_handle: string;
  placement_type: SponsoredPlacement["placementType"];
  target_label: string;
  headline: string;
  description: string;
  store_handle: string;
  design_handle: string;
  image_url: string;
  starts_at: string;
  ends_at: string;
};

type SponsoredPlacementsPayload = {
  placements: SponsoredPlacementPayload[];
};

export async function loadSponsoredPlacements(
  limit = 4,
): Promise<SponsoredPlacement[]> {
  try {
    const response = await fetch(
      `${API_BASE}/v1/public/sponsored?limit=${encodeURIComponent(String(limit))}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as SponsoredPlacementsPayload;
    return (payload.placements ?? []).map(mapSponsoredPlacement);
  } catch {
    return [];
  }
}

export type SponsoredEventInput = {
  campaignId: string;
  eventType: "impression" | "click";
  visitorId: string;
  pageUrl: string;
  referrerUrl: string;
};

export async function recordSponsoredEvent(
  input: SponsoredEventInput,
  request: Request,
): Promise<boolean> {
  if (!input.campaignId || !input.eventType || !input.visitorId) {
    return false;
  }
  const response = await fetch(
    `${API_BASE}/v1/public/sponsored/${encodeURIComponent(input.campaignId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("User-Agent") ?? "Xtiitch marketing",
        "X-Forwarded-For":
          request.headers.get("X-Forwarded-For") ??
          request.headers.get("CF-Connecting-IP") ??
          "",
      },
      body: JSON.stringify({
        event_type: input.eventType,
        visitor_id: input.visitorId,
        page_url: input.pageUrl,
        referrer_url: input.referrerUrl,
      }),
    },
  );
  return response.ok;
}

function mapSponsoredPlacement(
  payload: SponsoredPlacementPayload,
): SponsoredPlacement {
  const storeHandle = payload.store_handle || payload.business_handle;
  const designHandle = payload.design_handle;
  return {
    campaignId: payload.campaign_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    placementType: payload.placement_type,
    targetLabel: payload.target_label,
    headline: payload.headline,
    description: payload.description,
    storeHandle,
    designHandle,
    imageUrl: payload.image_url,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    href: storefrontHref(storeHandle, designHandle),
  };
}

function storefrontHref(storeHandle: string, designHandle: string): string {
  const configured = readEnv("XTIITCH_STOREFRONT_BASE_URL")?.replace(
    /\/+$/,
    "",
  );
  if (configured?.includes("{handle}")) {
    const base = configured.replace("{handle}", encodeURIComponent(storeHandle));
    return designHandle ? `${base}/d/${encodeURIComponent(designHandle)}` : base;
  }
  if (configured) {
    const path = designHandle
      ? `/d/${encodeURIComponent(designHandle)}`
      : `/store/${encodeURIComponent(storeHandle)}`;
    return `${configured}${path}`;
  }
  const base = `https://${encodeURIComponent(storeHandle)}.xtiitch.com`;
  return designHandle ? `${base}/d/${encodeURIComponent(designHandle)}` : base;
}
