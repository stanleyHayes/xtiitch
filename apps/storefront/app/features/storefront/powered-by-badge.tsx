import { Box, Link as MuiLink, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { XtiitchPlatformLogo } from "./platform-logo";

// The "Powered by Xtiitch" badge at the foot of a storefront.
//
// Shown on every store whose plan does not grant its removal — in practice the
// Free tier, which pays no subscription and carries the attribution instead
// (Pricing Book §5). Removing it is one of the things a paid plan buys, so
// whether it renders is decided by the plan entitlement the API already
// resolved, never by the plan's name.
//
// Deliberately quiet: it is a merchant's shopfront, not an advert. It sits below
// the store's own content, matches the store's brand colour, and is small enough
// to read as a footer credit rather than a banner.
export function PoweredByBadge({ brand }: { brand: string }) {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        py: 2.5,
        px: 2,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <MuiLink
        href="https://xtiitch.com"
        target="_blank"
        rel="noopener"
        underline="none"
        sx={{
          color: "text.secondary",
          "&:hover": { color: brand },
          transition: "color 120ms ease",
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <XtiitchPlatformLogo size={18} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Powered by Xtiitch
          </Typography>
        </Stack>
      </MuiLink>
    </Box>
  );
}
