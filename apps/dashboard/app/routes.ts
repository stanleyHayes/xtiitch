import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The business dashboard, served at app.xtiitch.com. The index redirects into
// the dashboard, which itself bounces to /login when there is no session.
export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("dashboard/:section?", "routes/dashboard.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
