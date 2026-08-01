import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import CheckroomRounded from "@mui/icons-material/CheckroomRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { tokens } from "../../../theme";

// The register page's decorative background: a burgundy gradient, a fine dot
// screen, and three oversized fashion glyphs bled off the edges.
//
// Extracted from RegisterForm so the form file stays under its size budget and
// reads as a form rather than as a painting. Purely presentational and entirely
// aria-hidden — a screen reader hears none of it.
//
// The glyphs are positioned with negative offsets, so the container MUST keep
// `overflow: hidden`; without it they widen the page on a phone.
export function RegisterBackdrop() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        backgroundImage: `
          radial-gradient(circle at 16% 12%, ${alpha(tokens.white, 0.12)} 0, transparent 28%),
          radial-gradient(circle at 88% 84%, ${alpha(tokens.gold, 0.18)} 0, transparent 32%),
          linear-gradient(135deg, #5b0017 0%, ${tokens.burgundy} 48%, #3b000f 100%)
        `,
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          opacity: 0.22,
          backgroundImage: `radial-gradient(${alpha(tokens.white, 0.22)} 0.7px, transparent 0.7px)`,
          backgroundSize: "7px 7px",
          maskImage: "linear-gradient(to bottom, black, transparent 82%)",
        },
      }}
    >
      <CheckroomRounded
        sx={{
          position: "absolute",
          top: { xs: 38, md: "7%" },
          left: { xs: -48, md: "5%" },
          width: { xs: 180, md: 300 },
          height: { xs: 180, md: 300 },
          color: alpha(tokens.white, 0.11),
          transform: "rotate(-12deg)",
        }}
      />
      <ContentCutRounded
        sx={{
          position: "absolute",
          right: { xs: -54, md: "3%" },
          top: { xs: "38%", md: "13%" },
          width: { xs: 190, md: 330 },
          height: { xs: 190, md: 330 },
          color: alpha(tokens.gold, 0.18),
          transform: "rotate(18deg)",
        }}
      />
      <StorefrontRounded
        sx={{
          position: "absolute",
          left: { xs: "18%", md: "12%" },
          bottom: { xs: -58, md: "-12%" },
          width: { xs: 190, md: 360 },
          height: { xs: 190, md: 360 },
          color: alpha(tokens.white, 0.09),
          transform: "rotate(7deg)",
        }}
      />
    </Box>
  );
}
