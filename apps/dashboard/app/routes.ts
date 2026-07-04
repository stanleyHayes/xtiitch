import { type RouteConfig, index, route } from "@react-router/dev/routes";

// The business dashboard, served at app.xtiitch.com. The index redirects into
// the dashboard, which itself bounces to /login when there is no session.
export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  // Resource route: same-origin proxy for the signup form's real-time store
  // handle availability check (the API base isn't reachable from the browser).
  route("handle-check", "routes/handle-check.ts"),
  // Resource route: same-origin proxy for the WhatsApp one-time-code "Send code"
  // buttons on sign-in / sign-up (forwards to the opaque OTP-request endpoints).
  route("business-otp", "routes/business-otp.ts"),
  route("onboarding/billing", "routes/billing-onboarding.tsx"),
  route("onboarding/billing/callback", "routes/billing-callback.tsx"),
  route("addons/ai-assistant", "routes/addons.ai-assistant.tsx"),
  route(
    "addons/ai-assistant/callback",
    "routes/addons.ai-assistant.callback.tsx",
  ),
  route("security", "routes/security.tsx"),
  route("dashboard/:section?", "routes/dashboard.tsx"),
  // Resource route for the ✨ AI writing assistant (no UI; proxies to the API
  // with the session token). See routes/ai-assist.ts.
  route("ai/assist", "routes/ai-assist.ts"),
  route("help", "routes/help.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
