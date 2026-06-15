import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const muiComponents = [
  "Alert",
  "Box",
  "Button",
  "Chip",
  "Container",
  "CssBaseline",
  "Divider",
  "Drawer",
  "FormControl",
  "InputAdornment",
  "List",
  "ListItemButton",
  "ListItemIcon",
  "ListItemText",
  "MenuItem",
  "Paper",
  "Select",
  "Stack",
  "Tab",
  "Tabs",
  "TextField",
  "Toolbar",
  "Typography",
].map((name) => `@mui/material/${name}`);

const muiIcons = [
  "AdminPanelSettingsRounded",
  "ArrowForwardRounded",
  "CancelRounded",
  "CheckCircleRounded",
  "LogoutRounded",
  "PaymentsRounded",
  "PersonSearchRounded",
  "ReceiptLongRounded",
  "SearchRounded",
  "ShieldRounded",
  "StorefrontRounded",
  "SupportAgentRounded",
  "TrendingUpRounded",
  "VerifiedUserRounded",
  "WarningAmberRounded",
].map((name) => `@mui/icons-material/${name}`);

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 3300,
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
