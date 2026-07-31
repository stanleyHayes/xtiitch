import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("activate", "routes/activate.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("terms", "routes/terms.tsx"),
  route("portal", "routes/portal.tsx"),
  route("portal/qr.png", "routes/qr.tsx"),
  route("portal/reports/conversions.csv", "routes/report.tsx"),
  route("logout", "routes/logout.tsx")
] satisfies RouteConfig;
