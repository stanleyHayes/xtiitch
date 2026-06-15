import type { Config } from "@react-router/dev/config";

export default {
  // Admin is SSR-rendered so protected screens can redirect before rendering.
  ssr: true,
} satisfies Config;
