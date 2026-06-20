import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

const future = {
  v8_middleware: true,
  v8_passThroughRequests: true,
  v8_splitRouteModules: true,
  v8_trailingSlashAwareDataRequests: true,
  v8_viteEnvironmentApi: true,
} satisfies Config["future"];

export default {
  // SSR so storefronts ship real HTML for SEO, shareable links, and shoppers on
  // weak connections.
  future,
  ssr: true,
  // Vercel deployment: enables per-route function config, route-aware bundling,
  // and an accurate deployment summary. https://vercel.com/docs/frameworks/react-router
  presets: [vercelPreset()],
} satisfies Config;
