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
  "RadioButtonUncheckedRounded",
  "SearchRounded",
  "StorefrontOutlined",
  "VerifiedRounded",
].map((name) => `@mui/icons-material/${name}`);

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 3100,
  },
  resolve: {
    dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled", "@emotion/cache"],
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
      "react-transition-group",
    ],
  },
});
