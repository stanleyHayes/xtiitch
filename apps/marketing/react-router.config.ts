import type { Config } from "@react-router/dev/config";

export default {
  // Server-side render every route. The marketing site must ship real HTML
  // content for SEO and for shoppers on weak connections (see docs/marketing).
  ssr: true,
} satisfies Config;
