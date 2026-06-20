import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/customers/:id/export", "routes/customer-export.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
