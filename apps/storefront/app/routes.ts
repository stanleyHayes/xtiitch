import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The customer storefront. Each business is reached at <handle>.xtiitch.com;
// subdomain-based store resolution replaces the legacy /store/:handle path in a
// follow-up step, so both are kept working during the transition.
export default [
  index("routes/home.tsx"),
  route("store/:handle", "routes/store.tsx"),
  route("d/:handle", "routes/design.tsx"),
  route("c/:handle", "routes/collection.tsx"),
  route("track/:orderId", "routes/track.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
