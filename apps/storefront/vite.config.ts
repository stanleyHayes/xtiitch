import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// Pre-declare client dependencies so Vite optimizes them once at startup rather
// than discovering them per route (which causes reload churn and un-hydrated
// pages). Same approach proven out in apps/marketing.
const muiComponents = [
  "Alert",
  "AppBar",
  "Box",
  "Breadcrumbs",
  "Button",
  "Card",
  "CardActionArea",
  "CardContent",
  "CardMedia",
  "Checkbox",
  "Chip",
  "Container",
  "CssBaseline",
  "Divider",
  "FormControlLabel",
  "InputAdornment",
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
  "ArrowBackRounded",
  "ArrowForwardRounded",
  "CheckCircleRounded",
  "Circle",
  "CollectionsBookmarkRounded",
  "ContentCutRounded",
  "CreditCardRounded",
  "HomeWorkRounded",
  "LocalShippingRounded",
  "PointOfSaleRounded",
  "RadioButtonUncheckedRounded",
  "SearchRounded",
  "SecurityRounded",
  "StorefrontRounded",
  "StorefrontOutlined",
  "StraightenRounded",
  "VerifiedRounded",
].map((name) => `@mui/icons-material/${name}`);

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 3100,
    // A business store is served at <handle>.xtiitch.com; in development that is
    // <handle>.localhost:3100, so the dev server must accept those hosts.
    allowedHosts: [".localhost", ".xtiitch.com"],
  },
  resolve: {
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
      "@mui/material/styles",
      ...muiComponents,
      ...muiIcons,
    ],
  },
  ssr: {
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
