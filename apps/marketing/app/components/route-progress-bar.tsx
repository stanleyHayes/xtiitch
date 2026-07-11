import Box from "@mui/material/Box";
import { tokens } from "../theme";

// A thin top progress bar shown only while a page route is loading — replaces the
// old full-page skeleton card that flashed over the UI on every form submit.
export function RouteProgressBar() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 2400,
        overflow: "hidden",
        pointerEvents: "none",
        bgcolor: "rgba(128, 0, 32, 0.12)",
        "@keyframes routeProgressSlide": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, transparent, ${tokens.burgundy}, transparent)`,
          animation: "routeProgressSlide 1.1s ease-in-out infinite",
        },
      }}
    />
  );
}
