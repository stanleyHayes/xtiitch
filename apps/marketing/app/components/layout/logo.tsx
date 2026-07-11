import { Link as RouterLink, useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { site } from "../../content";
import { XtiitchMark } from "./mark";

export function Logo({
  onClick,
  tone = "dark",
}: {
  onClick?: () => void;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";
  const theme = useTheme();
  // The ii mark is wine on a light bar, but must go cream on the dark bar/theme
  // (the wordmark already adapts via text.primary).
  const markColor =
    isLight || theme.palette.mode === "dark" ? "#faf6f2" : "#800020";
  // Owner-managed platform logo from the public branding endpoint (loaded by the
  // root loader). Falls back to the built-in ii-stitch mark when unset.
  const branding = useRouteLoaderData("root") as
    | { brandLogoUrl?: string }
    | undefined;
  const brandLogoUrl = branding?.brandLogoUrl ?? "";
  return (
    <Box
      component={RouterLink}
      to="/"
      onClick={onClick}
      aria-label={`${site.name} home`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        textDecoration: "none",
        color: isLight ? "common.white" : "text.primary",
        transition: "transform 180ms ease, color 180ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
        },
      }}
    >
      {brandLogoUrl ? (
        <Box
          component="img"
          src={brandLogoUrl}
          alt={site.name}
          sx={{
            height: 32,
            width: "auto",
            maxWidth: 150,
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
      ) : (
        <>
          <XtiitchMark
            color={markColor}
            size={30}
            sx={{
              flexShrink: 0,
              transition: "transform 220ms ease",
              ".MuiBox-root:hover > &": { transform: "translateY(-2px)" },
            }}
          />
          <Typography
            component="span"
            sx={{ fontWeight: 800, fontSize: 23, letterSpacing: "-0.01em" }}
          >
            Xtiitch
          </Typography>
        </>
      )}
    </Box>
  );
}
