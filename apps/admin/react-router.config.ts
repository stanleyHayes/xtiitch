import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

const future = {
  v8_middleware: true,
  v8_passThroughRequests: true,
  v8_splitRouteModules: true,
  v8_trailingSlashAwareDataRequests: true,
  // v8_viteEnvironmentApi intentionally OFF: with it on, the production build
  // ignores `ssr.noExternal`, so MUI stays external and its .mjs does an ESM
  // directory import of react-transition-group that crashes on Vercel
  // (ERR_UNSUPPORTED_DIR_IMPORT). Off, the build bundles MUI as configured.
} satisfies Config["future"];

export default {
  // Admin is SSR-rendered so protected screens can redirect before rendering.
  future,
  ssr: true,
  // Vercel deployment: enables per-route function config, route-aware bundling,
  // and an accurate deployment summary. https://vercel.com/docs/frameworks/react-router
  presets: [vercelPreset()],
} satisfies Config;
