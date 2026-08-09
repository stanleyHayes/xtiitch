import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CheckroomRounded from "@mui/icons-material/CheckroomRounded";
import EastRounded from "@mui/icons-material/EastRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import { tokens } from "../../theme";

export default function EmptyCart() {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: { xs: 3, md: 4 },
        bgcolor: "background.paper",
        boxShadow: (theme) =>
          `0 24px 80px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.22 : 0.08)}`,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) 0.95fr" },
          minHeight: { md: 390 },
        }}
      >
        <EmptyCartMessage />
        <EmptyCartArtwork />
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 1.5, sm: 4 }}
        sx={{
          px: { xs: 3, sm: 5, md: 7 },
          py: 2.25,
          borderTop: "1px solid",
          borderColor: "divider",
          color: "text.secondary",
        }}
      >
        <EmptyCartNote
          icon={<StraightenRounded fontSize="small" />}
          text="Ready-to-wear and bespoke"
        />
        <EmptyCartNote
          icon={<LocalShippingRounded fontSize="small" />}
          text="Studio pickup or delivery"
        />
      </Stack>
    </Box>
  );
}

function EmptyCartMessage() {
  return (
    <Stack
      spacing={2.5}
      sx={{
        justifyContent: "center",
        px: { xs: 3, sm: 5, md: 7 },
        py: { xs: 5, md: 7 },
      }}
    >
      <Typography
        variant="overline"
        sx={{
          color: "primary.main",
          fontWeight: 900,
          letterSpacing: "0.16em",
          lineHeight: 1,
        }}
      >
        Your next piece starts here
      </Typography>
      <Typography
        component="h2"
        sx={{
          maxWidth: 520,
          fontFamily: "var(--font-display, inherit)",
          fontSize: { xs: "2.25rem", sm: "3rem", md: "3.5rem" },
          fontWeight: 800,
          letterSpacing: "-0.035em",
          lineHeight: 0.98,
          textWrap: "balance",
        }}
      >
        Nothing in the bag. Plenty worth finding.
      </Typography>
      <Typography
        sx={{
          maxWidth: 500,
          color: "text.secondary",
          fontSize: { xs: "1rem", md: "1.05rem" },
          lineHeight: 1.7,
        }}
      >
        Browse made-to-wear pieces and bespoke designs from independent Ghanaian
        studios. Your selections will wait here for checkout.
      </Typography>
      {/* §6: "/" and nothing else. On a tenant host that is the store's OWN
          storefront; on the marketplace it is the cross-store browse. Pointing
          this at the marketplace search would send a shopper standing in one
          studio's cart out to every other studio — an easy "improvement" to
          make by accident, which is why it is written down here. */}
      <Button
        component={RouterLink}
        to="/"
        variant="contained"
        endIcon={<EastRounded />}
        sx={{
          alignSelf: "flex-start",
          minHeight: 52,
          px: 3,
          fontSize: "1rem",
          transition: "transform 180ms ease, background-color 180ms ease",
          "&:hover": { transform: "translateY(-2px)" },
          "&:active": { transform: "translateY(0) scale(0.98)" },
        }}
      >
        Explore the collection
      </Button>
    </Stack>
  );
}

function EmptyCartArtwork() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "relative",
        display: { xs: "none", md: "grid" },
        placeItems: "center",
        overflow: "hidden",
        bgcolor: tokens.burgundy,
        color: tokens.white,
        backgroundImage: `radial-gradient(circle at 24% 20%, ${alpha(tokens.white, 0.16)}, transparent 28%), radial-gradient(circle at 82% 78%, ${alpha(tokens.ink, 0.22)}, transparent 36%)`,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 330,
          height: 330,
          border: `1px solid ${alpha(tokens.white, 0.22)}`,
          borderRadius: "48% 52% 42% 58% / 55% 40% 60% 45%",
          transform: "rotate(12deg)",
        }}
      />
      <CheckroomRounded
        sx={{
          position: "relative",
          zIndex: 1,
          fontSize: 178,
          opacity: 0.94,
          filter: `drop-shadow(0 20px 32px ${alpha(tokens.ink, 0.22)})`,
        }}
      />
      <Typography
        sx={{
          position: "absolute",
          right: -18,
          bottom: -34,
          fontFamily: "var(--font-display, inherit)",
          fontSize: 128,
          fontWeight: 900,
          letterSpacing: "-0.08em",
          opacity: 0.07,
        }}
      >
        XTIITCH
      </Typography>
    </Box>
  );
}

function EmptyCartNote({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box sx={{ display: "grid", color: "primary.main" }}>{icon}</Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {text}
      </Typography>
    </Stack>
  );
}
