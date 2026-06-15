import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("store/:handle", "routes/store.tsx"),
  route("d/:handle", "routes/design.tsx"),
  route("c/:handle", "routes/collection.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
