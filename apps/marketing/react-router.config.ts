import type { Config } from "@react-router/dev/config";

const future = {
  v8_middleware: true,
  v8_passThroughRequests: true,
  v8_splitRouteModules: true,
  v8_trailingSlashAwareDataRequests: true,
  v8_viteEnvironmentApi: true,
} satisfies Config["future"];

export default {
  // Server-side render every route. The marketing site must ship real HTML
  // content for SEO and for shoppers on weak connections (see docs/marketing).
  future,
  ssr: true,
} satisfies Config;
