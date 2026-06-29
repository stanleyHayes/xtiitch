import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The customer storefront. Each business is reached at <handle>.xtiitch.com;
// subdomain-based store resolution replaces the legacy /store/:handle path in a
// follow-up step, so both are kept working during the transition.
export default [
  index("routes/home.tsx"),
  route("discover", "routes/discover.tsx"),
  route("account", "routes/account.tsx"),
  route("store/:handle", "routes/store.tsx"),
  route("d/:handle", "routes/design.tsx"),
  route("c/:handle", "routes/collection.tsx"),
  route("cart", "routes/cart.tsx"),
  route("checkout", "routes/checkout.tsx"),
  route("track", "routes/track-lookup.tsx"),
  route("track/:orderId", "routes/track.tsx"),
  route("robots.txt", "routes/robots.tsx"),
  route("sitemap.xml", "routes/sitemap.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
