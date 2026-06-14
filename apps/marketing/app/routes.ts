import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("features", "routes/features.tsx"),
  route("how-it-works", "routes/how-it-works.tsx"),
  route("pricing", "routes/pricing.tsx"),
  route("for-customers", "routes/for-customers.tsx"),
  route("security", "routes/security.tsx"),
  route("faq", "routes/faq.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("contact", "routes/contact.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
