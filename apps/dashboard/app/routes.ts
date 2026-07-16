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
  // Resource route: same-origin proxy for the payout panel's "Verify number"
  // button. Separate from business-otp because this one is authenticated — the
  // owner is proving a payout destination, not signing in.
  route("payout-otp", "routes/payout-otp.ts"),
  route("onboarding/billing", "routes/billing-onboarding.tsx"),
  route("onboarding/billing/callback", "routes/billing-callback.tsx"),
  // Canonical paid-plan activation page. The banner, blocked primary actions and
  // the global 402 handler all route here; it resolves the pending plan itself.
  route("activate", "routes/activate.tsx"),
  route("addons/ai-assistant", "routes/addons.ai-assistant.tsx"),
  route(
    "addons/ai-assistant/callback",
    "routes/addons.ai-assistant.callback.tsx",
  ),
  route("security", "routes/security.tsx"),
  route("dashboard/:section?", "routes/dashboard.tsx"),
  // Resource route backing the design editor's colour-variation and per-design
  // size-band-override panels (GET current state; POST create/update/delete/
  // reorder variations and set/clear an override). See design-editor.$id.ts.
  route("design-editor/:id", "routes/design-editor.$id.ts"),
  // Resource route for the ✨ AI writing assistant (no UI; proxies to the API
  // with the session token). See routes/ai-assist.ts.
  route("ai/assist", "routes/ai-assist.ts"),
  route("help", "routes/help.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
