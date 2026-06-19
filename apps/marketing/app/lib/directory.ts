// Public shops directory client for the discovery pages. Reads the
// unauthenticated /public/shops endpoint (verified, active storefronts) and
// resolves storefront links the same way the sponsored placements do.
const API_BASE = process.env.XTIITCH_API_URL ?? "http://localhost:8080";

export type DirectoryDesign = {
  title: string;
  handle: string;
  image: string;
  priceMinor: number;
  href: string;
  // Shop context, carried so a flat design grid can show where it comes from.
  shopName: string;
  shopHandle: string;
  brandColor: string;
};

export type DirectoryShop = {
  businessId: string;
  name: string;
  handle: string;
  brandColor: string;
  designCount: number;
  designs: DirectoryDesign[];
  href: string;
};

type ShopDesignPayload = {
  title: string;
  handle: string;
  image: string;
  price_minor: number;
};

type ShopPayload = {
  business_id: string;
  name: string;
  handle: string;
  brand_color: string;
  design_count: number;
  designs: ShopDesignPayload[];
};

export async function loadPublicShops(): Promise<DirectoryShop[]> {
  try {
    const response = await fetch(`${API_BASE}/v1/public/shops`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { shops?: ShopPayload[] };
    return (payload.shops ?? []).map(mapShop);
  } catch {
    return [];
  }
}

// Flatten every shop's sample designs into one list for the designs grid.
export function flattenDesigns(shops: DirectoryShop[]): DirectoryDesign[] {
  return shops.flatMap((shop) => shop.designs);
}

export function formatGHS(minor: number): string {
  if (!minor) {
    return "Ask for price";
  }
  return `GH₵${(minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function mapShop(payload: ShopPayload): DirectoryShop {
  const brandColor = payload.brand_color || "#800020";
  return {
    businessId: payload.business_id,
    name: payload.name,
    handle: payload.handle,
    brandColor,
    designCount: payload.design_count,
    href: storefrontHref(payload.handle),
    designs: (payload.designs ?? []).map((design) => ({
      title: design.title,
      handle: design.handle,
      image: design.image,
      priceMinor: design.price_minor,
      href: storefrontHref(payload.handle, design.handle),
      shopName: payload.name,
      shopHandle: payload.handle,
      brandColor,
    })),
  };
}

function storefrontHref(storeHandle: string, designHandle = ""): string {
  const configured = process.env.XTIITCH_STOREFRONT_BASE_URL?.replace(
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
