import type { Config } from "@react-router/dev/config";

const future = {
  v8_middleware: true,
  v8_passThroughRequests: true,
  v8_splitRouteModules: true,
  v8_trailingSlashAwareDataRequests: true,
  v8_viteEnvironmentApi: true,
} satisfies Config["future"];

export default {
  // Admin is SSR-rendered so protected screens can redirect before rendering.
  future,
  ssr: true,
} satisfies Config;
