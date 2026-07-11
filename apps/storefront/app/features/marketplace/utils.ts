export function storeHref(handle: string) {
  return `/store/${encodeURIComponent(handle)}`;
}

// A design opens its single buy page on the marketplace domain (/d/:handle),
// not the shop's separate storefront — the shopper stays in the marketplace
// (Updates §4). The design page still shows other pieces from the same shop.
export function designHref(handle: string) {
  return `/d/${encodeURIComponent(handle)}`;
}
