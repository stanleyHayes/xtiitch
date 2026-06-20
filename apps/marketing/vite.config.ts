import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// Pre-declare every dependency used in the client graph so Vite optimizes them
// once at startup instead of discovering them lazily per route. Lazy discovery
// triggers mid-session re-optimization + reloads, which can make entry.client
// fail to load and leave the page un-hydrated.
const muiComponents = [
  "Accordion",
  "AccordionDetails",
  "AccordionSummary",
  "Alert",
  "AppBar",
  "Box",
  "Button",
  "Card",
  "CardContent",
  "Chip",
  "Container",
  "CssBaseline",
  "Divider",
  "Drawer",
  "IconButton",
  "Link",
  "Pagination",
  "Paper",
  "Skeleton",
  "Stack",
  "TextField",
  "Toolbar",
  "Typography",
].map((name) => `@mui/material/${name}`);

const muiIcons = [
  "ArrowForwardRounded",
  "CheckCircleRounded",
  "Circle",
  "Close",
  "CollectionsOutlined",
  "EventAvailableOutlined",
  "ExpandMore",
  "InfoOutlined",
  "LocalShippingOutlined",
  "Menu",
  "NotificationsActiveOutlined",
  "PaymentsOutlined",
  "ReceiptLongOutlined",
  "SavingsOutlined",
  "StorefrontOutlined",
].map((name) => `@mui/icons-material/${name}`);

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 3000,
  },
  resolve: {
    // Force a single physical copy of these so MUI and our CacheProvider share
    // one Emotion instance (otherwise "@emotion/react loaded twice" warnings
    // and split styling/hydration context).
    dedupe: [
      "react",
      "react-dom",
      "@emotion/react",
      "@emotion/styled",
      "@emotion/cache",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react-router/dom",
      "@emotion/react",
      "@emotion/styled",
      "@emotion/cache",
      "zod",
      "@mui/material/styles",
      ...muiComponents,
      ...muiIcons,
    ],
  },
  ssr: {
    // MUI's ESM does a directory import of react-transition-group that Vite's
    // dev SSR module runner can't resolve natively. Bundling these for SSR
    // (instead of externalizing) fixes the dev 500.
    noExternal: [
      /^@mui\//,
      "@emotion/react",
      "@emotion/styled",
      "@emotion/cache",
      "@emotion/server",
      "@xtiitch/design-tokens",
      "react-transition-group",
    ],
  },
});
