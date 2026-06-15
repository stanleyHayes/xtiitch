import type { Config } from "@react-router/dev/config";

export default {
  // SSR so storefronts ship real HTML for SEO, shareable links, and shoppers on
  // weak connections.
  ssr: true,
} satisfies Config;
