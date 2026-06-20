import { reactRouter } from "@react-router/dev/vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";

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
  "IconButton",
  "InputAdornment",
  "Link",
  "MenuItem",
  "Pagination",
  "Paper",
  "Skeleton",
  "Snackbar",
  "Stack",
  "TextField",
  "Toolbar",
  "Tooltip",
  "Typography",
].map((name) => `@mui/material/${name}`);

const muiIcons = [
  "AccountBalanceWalletRounded",
  "AddRounded",
  "ArrowBackRounded",
  "ArrowForwardRounded",
  "CalendarMonthRounded",
  "CheckCircleRounded",
  "Circle",
  "CloudUploadRounded",
  "ContentCutRounded",
  "DeleteOutlineRounded",
  "DesignServicesRounded",
  "EventAvailableRounded",
  "Inventory2Rounded",
  "LocalShippingRounded",
  "LogoutRounded",
  "NotificationsRounded",
  "PaletteRounded",
  "PaymentsRounded",
  "PeopleAltRounded",
  "PhoneRounded",
  "PriceCheckRounded",
  "QueryStatsRounded",
  "RadioButtonUncheckedRounded",
  "ReceiptLongRounded",
  "SaveRounded",
  "ScheduleRounded",
  "SearchRounded",
  "SettingsRounded",
  "StorefrontOutlined",
  "StorefrontRounded",
  "StraightenRounded",
  "TimelineRounded",
  "TrendingUpRounded",
  "TuneRounded",
  "VerifiedUserRounded",
  "VerifiedRounded",
  "VisibilityRounded",
  "WarningAmberRounded",
].map((name) => `@mui/icons-material/${name}`);

function reactRouterCriticalCssFallback(): Plugin {
  return {
    name: "xtiitch-react-router-critical-css-fallback",
    configureServer(server) {
      server.middlewares.use(
        (
          request: IncomingMessage,
          response: ServerResponse,
          next: () => void,
        ) => {
          if (request.url?.startsWith("/@react-router/critical.css")) {
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/css");
            response.end("");
            return;
          }

          next();
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [reactRouterCriticalCssFallback(), reactRouter()],
  server: {
    port: 3100,
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
