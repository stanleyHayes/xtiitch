import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import type { Design, StoreSummary } from "../../lib/api";
import TextField from "../../components/form-text-field";
import { ThemeModeToggle } from "../../theme-mode";
import { tokens } from "../../theme";

// Readable text colour for an arbitrary brand background.
function contrastText(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) {
    return "#ffffff";
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#15111a" : "#ffffff";
}

export function StoreHeader({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  store,
  designs,
  query,
}: {
  store: StoreSummary;
  designs: Design[];
  query: string;
}) {
  const brand = store.brand_color || "#800020";
  const onBrand = contrastText(brand);
  // Plan-gated storefront customizations (the API only returns these for entitled
  // plans; otherwise they fall back to the Xtiitch defaults below).
  const logoURL = store.settings.logo_url?.trim() ?? "";
  const bannerURL = store.settings.banner_url?.trim() ?? "";
  const layout = store.settings.layout_variant || "standard";
  const heroImage = bannerURL || "/images/storefront-atelier-hero.webp";
  const heroGradient =
    layout === "minimal"
      ? `linear-gradient(120deg, ${alpha(brand, 0.98)}, ${alpha(brand, 0.9)})`
      : layout === "spotlight"
        ? `linear-gradient(90deg, ${alpha(brand, 0.82)} 0%, ${alpha(brand, 0.4)} 52%, ${alpha(brand, 0.12)} 100%)`
        : `linear-gradient(90deg, ${alpha(brand, 0.96)} 0%, ${alpha(brand, 0.88)} 46%, ${alpha(brand, 0.46)} 100%)`;
  const heroBackground =
    layout === "minimal"
      ? heroGradient
      : `${heroGradient}, url("${heroImage}")`;
  const heroMinHeight =
    layout === "minimal"
      ? { xs: 420, md: 460 }
      : layout === "spotlight"
        ? { xs: 540, md: 620 }
        : { xs: 500, md: 560 };
  const customisableCount = designs.filter(
    (design) => design.customisation_allowed,
  ).length;
  const pricedCount = designs.filter(
    (design) => design.prices.length > 0,
  ).length;
  return (
    <Box
      component="header"
      sx={{
        color: onBrand,
        position: "relative",
        overflow: "hidden",
        backgroundImage: heroBackground,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: heroMinHeight,
        display: "flex",
        flexDirection: "column",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${alpha(onBrand, 0.08)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(onBrand, 0.08)} 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
          maskImage:
            "linear-gradient(90deg, black 0%, black 58%, transparent 100%)",
          pointerEvents: "none",
        },
      }}
    >
      <Container
        sx={{
          position: "relative",
          zIndex: 1,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              bgcolor: logoURL ? alpha(onBrand, 0.95) : alpha(onBrand, 0.13),
              border: "1px solid",
              borderColor: alpha(onBrand, 0.18),
              flexShrink: 0,
            }}
          >
            {logoURL ? (
              <Box
                component="img"
                src={logoURL}
                alt={`${store.name} logo`}
                sx={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <StorefrontOutlined />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900 }} noWrap>
              {store.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{ opacity: 0.72, fontWeight: 800 }}
              noWrap
            >
              {store.handle}.xtiitch.com
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center" }}
        >
          <ThemeModeToggle sx={{ color: onBrand }} />
          <Button
            href="#designs"
            variant="contained"
            sx={{
              bgcolor: alpha(onBrand, 0.92),
              color: brand,
              "&:hover": { bgcolor: onBrand },
            }}
          >
            Browse pieces
          </Button>
          <Button
            component={RouterLink}
            to="/cart"
            variant="outlined"
            startIcon={<ShoppingBagRounded />}
            sx={{
              color: onBrand,
              borderColor: alpha(onBrand, 0.32),
              "&:hover": { borderColor: alpha(onBrand, 0.58) },
            }}
          >
            Cart
          </Button>
          <Button
            component={RouterLink}
            to="/track"
            variant="outlined"
            sx={{
              color: onBrand,
              borderColor: alpha(onBrand, 0.32),
              "&:hover": { borderColor: alpha(onBrand, 0.58) },
            }}
          >
            Track order
          </Button>
          <Button
            component={RouterLink}
            to="/account"
            variant="outlined"
            startIcon={<AccountCircleRounded />}
            sx={{
              color: onBrand,
              borderColor: alpha(onBrand, 0.32),
              "&:hover": { borderColor: alpha(onBrand, 0.58) },
            }}
          >
            Account
          </Button>
          <Button
            href="https://xtiitch.com"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            sx={{
              color: onBrand,
              borderColor: alpha(onBrand, 0.32),
              "&:hover": { borderColor: alpha(onBrand, 0.58) },
            }}
          >
            About Xtiitch
          </Button>
        </Stack>
      </Container>

      <Container
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "grid",
          alignItems: "center",
          py: { xs: 5, md: 7 },
        }}
      >
        <Box sx={{ maxWidth: 720 }}>
          <Stack
            direction="row"
            spacing={1.2}
            sx={{ alignItems: "center", mb: 1.25, flexWrap: "wrap" }}
          >
            <Chip
              size="small"
              icon={<VerifiedRounded />}
              label="Verified Xtiitch store"
              sx={{
                color: onBrand,
                bgcolor: alpha(onBrand, 0.12),
                border: "1px solid",
                borderColor: alpha(onBrand, 0.18),
                "& .MuiChip-icon": { color: alpha(onBrand, 0.78) },
              }}
            />
            <Chip
              size="small"
              label={`${designs.length} ${designs.length === 1 ? "piece" : "pieces"}`}
              sx={{
                color: onBrand,
                bgcolor: alpha(onBrand, 0.12),
                border: "1px solid",
                borderColor: alpha(onBrand, 0.18),
              }}
            />
          </Stack>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              maxWidth: 680,
              fontSize: { xs: "2.6rem", md: "4.15rem" },
              lineHeight: 0.98,
            }}
          >
            {store.name}
          </Typography>
          <Typography
            sx={{
              mt: 2,
              opacity: 0.82,
              maxWidth: 620,
              fontSize: { xs: 17, md: 20 },
            }}
          >
            Browse available pieces, choose a fit route, and start an order from
            the design that feels right.
          </Typography>

          <Form method="get" role="search">
            <TextField
              name="q"
              defaultValue={query}
              placeholder="Search pieces"
              size="medium"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                mt: 3,
                maxWidth: 560,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(var(--surface-rgb), 0.96)",
                  color: "text.primary",
                  boxShadow: `0 16px 42px ${alpha(tokens.ink, 0.16)}`,
                },
              }}
            />
          </Form>

          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
            {[
              { label: "Priced pieces", value: String(pricedCount) },
              { label: "Custom options", value: String(customisableCount) },
            ].map((signal) => (
              <Chip
                key={signal.label}
                label={`${signal.value} ${signal.label.toLowerCase()}`}
                sx={{
                  color: onBrand,
                  bgcolor: alpha(onBrand, 0.12),
                  border: "1px solid",
                  borderColor: alpha(onBrand, 0.18),
                  fontWeight: 850,
                }}
              />
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
