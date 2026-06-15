import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("store/:handle", "routes/store.tsx"),
  route("d/:handle", "routes/design.tsx"),
  route("c/:handle", "routes/collection.tsx"),
  route("track/:orderId", "routes/track.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
