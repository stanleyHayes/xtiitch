import Box from "@mui/material/Box";
import { useRouteLoaderData } from "react-router";
import { tokens } from "../../theme";

// The ii-stitch brand mark (two stitches joined by a seam), per the brand
// guidelines — the built-in fallback for the Xtiitch platform logo.
function XtiitchMark({
  color = tokens.burgundy,
  size = 28,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Box
      aria-hidden
      component="svg"
      viewBox="1.4 3.8 97.2 97.2"
      sx={{ width: size, height: size, display: "block", flexShrink: 0 }}
    >
      <line
        x1="37"
        y1="40"
        x2="37"
        y2="74"
        stroke={color}
        strokeWidth="15"
        strokeLinecap="round"
      />
      <line
        x1="63"
        y1="40"
        x2="63"
        y2="74"
        stroke={color}
        strokeWidth="15"
        strokeLinecap="round"
      />
      <circle cx="37" cy="22" r="8.2" fill={color} />
      <circle cx="63" cy="22" r="8.2" fill={color} />
      <path
        d="M37 72.5 Q50 91 63 72.5"
        stroke={color}
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />
    </Box>
  );
}

// The owner-managed Xtiitch platform logo (custom upload from the admin console,
// served by the public /v1/branding endpoint via the root loader). Falls back to
// the built-in ii-stitch mark when unset. This is the PLATFORM mark only — it is
// never the merchant's own store logo.
export function XtiitchPlatformLogo({
  color = tokens.burgundy,
  size = 28,
}: {
  color?: string;
  size?: number;
}) {
  const branding = useRouteLoaderData("root") as
    | { brandLogoUrl?: string }
    | undefined;
  const brandLogoUrl = branding?.brandLogoUrl ?? "";
  if (brandLogoUrl) {
    return (
      <Box
        component="img"
        src={brandLogoUrl}
        alt="Xtiitch"
        sx={{
          height: size,
          width: "auto",
          maxWidth: 132,
          objectFit: "contain",
          flexShrink: 0,
        }}
      />
    );
  }
  return <XtiitchMark color={color} size={size} />;
}
