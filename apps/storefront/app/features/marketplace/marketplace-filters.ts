import type { PublicShop } from "../../lib/api";
import { styleCategories } from "./style-categories";

// Marketplace search/filter predicates. Split out of marketplace.tsx so that
// screen stays within the file-size budget.

// The lowercased haystack for a shop: its name plus every design's title and
// style category, used for free-text search.
export function shopSearchText(shop: PublicShop): string {
  return [
    shop.name,
    ...shop.designs.flatMap((design) => [
      design.title,
      design.style_category ?? "",
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

// Whether a shop belongs in the selected style catalogue: a direct
// style_category match, or a keyword hit from the category's query.
export function matchesCatalogueFilter(shop: PublicShop, filter: string): boolean {
  if (!filter) return true;
  const config = styleCategories.find((item) => item.slug === filter);
  if (!config) return true;
  if (shop.designs.some((design) => design.style_category === config.slug)) {
    return true;
  }
  const text = shopSearchText(shop);
  return config.query.split(" ").some((keyword) => text.includes(keyword));
}
