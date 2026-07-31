// Recommended upload dimensions, derived from how the storefront actually
// renders each image — not invented. If a surface changes its aspect ratio,
// change it here too, or the guidance starts lying to merchants.
//
//   Design photos  4:5 portrait. Every shopper-facing surface crops to 4 / 5:
//                  the storefront design card, the design gallery, discover
//                  results, and the marketplace card. Upload anything squarer
//                  or wider and the storefront centre-crops it — heads and hems
//                  are what get cut.
//   Store banner   Full-width hero, background-size: cover, up to ~470px tall.
//                  Wide and shallow; the middle survives, the edges may not.
//   Store logo     44px square container with object-fit: contain, so a square
//                  export with a little padding sits correctly.
//
// The long edge maxes at 2000px because the browser-side resizer
// (image-compression.ts) never encodes above that. Recommending more would
// promise detail that is discarded on the way out.
export type ImageSpec = {
  label: string;
  dimensions: string;
  ratio: string;
  note: string;
};

export const DESIGN_IMAGE_SPEC: ImageSpec = {
  label: "Design photo",
  dimensions: "1600 × 2000 px",
  ratio: "4:5 portrait",
  note: "Shoppers see designs in a 4:5 portrait frame. Portrait photos fill it; square or landscape ones get cropped top and bottom.",
};

export const BANNER_IMAGE_SPEC: ImageSpec = {
  label: "Store banner",
  dimensions: "1920 × 640 px",
  ratio: "3:1 wide",
  note: "Sits behind your store name as a full-width header. Keep the important part centred — the sides crop on narrow screens.",
};

export const LOGO_IMAGE_SPEC: ImageSpec = {
  label: "Store logo",
  dimensions: "512 × 512 px",
  ratio: "1:1 square",
  note: "Shown small and square. A logo on a plain or transparent background reads best.",
};

// One-line form for a helper caption.
export function specSummary(spec: ImageSpec): string {
  return `${spec.dimensions} (${spec.ratio})`;
}
