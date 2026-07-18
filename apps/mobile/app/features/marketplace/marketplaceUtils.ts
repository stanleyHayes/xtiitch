import type { Shop, ShopDesign } from "../../../src/marketplaceApi";

// Tab and sort model mirrored from the web marketplace
// (apps/storefront/app/features/marketplace/types.ts and marketplace.tsx).
export type MarketplaceTab = "studios" | "designs";

export type SortKey = "popular" | "name" | "price_low" | "price_high";

// A design flattened with its shop context, like the web's FlatDesign.
export type FlatDesign = ShopDesign & {
  store_name: string;
  store_handle: string;
  brand_color: string;
};

export function flattenDesigns(shops: Shop[]): FlatDesign[] {
  return shops.flatMap((shop) =>
    shop.designs.map((design) => ({
      ...design,
      store_name: shop.name,
      store_handle: shop.handle,
      brand_color: shop.brand_color,
    })),
  );
}

// Mirrors the web's visibleStudios: name match, then popular (most designs)
// or A–Z. Returns a new array; the input order is never mutated.
export function visibleStudios(
  shops: Shop[],
  query: string,
  sort: SortKey,
): Shop[] {
  const q = query.trim().toLowerCase();
  const list = q
    ? shops.filter((shop) => shop.name.toLowerCase().includes(q))
    : shops;
  const sorted = [...list];
  if (sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    sorted.sort((a, b) => b.design_count - a.design_count);
  }
  return sorted;
}

// Mirrors the web's visibleDesigns: title or store-name match, then the
// selected sort ("popular" keeps the API's order, like the web's "Featured").
export function visibleDesigns(
  designs: FlatDesign[],
  query: string,
  sort: SortKey,
): FlatDesign[] {
  const q = query.trim().toLowerCase();
  const list = q
    ? designs.filter(
        (design) =>
          design.title.toLowerCase().includes(q) ||
          design.store_name.toLowerCase().includes(q),
      )
    : designs;
  const sorted = [...list];
  if (sort === "price_low") {
    sorted.sort((a, b) => a.price_minor - b.price_minor);
  } else if (sort === "price_high") {
    sorted.sort((a, b) => b.price_minor - a.price_minor);
  } else if (sort === "name") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
  return sorted;
}

// Empty-state copy mirrored from the web marketplace's EmptyState usage.
export function emptyCopy(
  tab: MarketplaceTab,
  query: string,
): { title: string; hint: string } {
  const q = query.trim();
  if (tab === "studios") {
    return q
      ? {
          title: `No studios match “${q}”`,
          hint: "Try a shorter or different name, or switch to Designs and describe what you're after.",
        }
      : {
          title: "Studios are on their way",
          hint: "Verified studios appear here as they open their storefronts. Check back soon — new shops are joining.",
        };
  }
  return q
    ? {
        title: `No designs match “${q}”`,
        hint: "Try a different keyword, or browse studios instead.",
      }
    : {
        title: "Designs are on their way",
        hint: "As studios add pieces they appear here. Check back soon.",
      };
}
