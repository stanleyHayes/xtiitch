import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("robots.txt", "routes/robots.ts"),
  route("login", "routes/login.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/customers/:id/export", "routes/customer-export.tsx"),
  route("admin/businesses/:id/activity", "routes/business-activity.tsx"),
  route("admin/payouts", "routes/payouts.tsx"),
  route("admin/payouts/:businessId/history", "routes/payout-history.tsx"),
  route("help", "routes/help.tsx"),
  route("splash", "routes/splash.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
