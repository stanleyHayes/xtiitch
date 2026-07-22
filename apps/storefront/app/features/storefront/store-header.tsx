import { Link as RouterLink } from "react-router";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";
import { ThemeModeToggle } from "../../theme-mode";
import { readableBrandText, resolveStoreBrand } from "./store-brand";
import { StoreNavMenu } from "./store-nav-menu";

const fallbackHero = "/images/storefront-atelier-hero.webp";

export function StoreHeader({ store }: { store: StoreSummary }) {
  const brand = resolveStoreBrand(store.brand_color);
  const onBrand = readableBrandText(brand);
  const logoURL = store.settings.logo_url?.trim() ?? "";
  const bannerURL = store.settings.banner_url?.trim() ?? "";
  const layout = store.settings.layout_variant || "standard";

  return (
    <Box component="header" sx={{ bgcolor: "background.paper" }}>
      <StoreNavBar
        store={store}
        brand={brand}
        onBrand={onBrand}
        logoURL={logoURL}
      />
      <StoreHero
        store={store}
        brand={brand}
        onBrand={onBrand}
        bannerURL={bannerURL}
        layout={layout}
      />
    </Box>
  );
}

function StoreNavBar({
  store,
  brand,
  onBrand,
  logoURL,
}: {
  store: StoreSummary;
  brand: string;
  onBrand: string;
  logoURL: string;
}) {
  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: alpha(tokens.ink, 0.09),
        bgcolor: "rgba(var(--surface-rgb), 0.96)",
      }}
    >
      <Container
        sx={{
          minHeight: { xs: 68, md: 78 },
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              color: onBrand,
              bgcolor: brand,
              flexShrink: 0,
            }}
          >
            {logoURL ? (
              <Box
                component="img"
                src={logoURL}
                alt={`${store.name} logo`}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  bgcolor: tokens.white,
                }}
              />
            ) : (
              <StorefrontOutlined />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="p"
              sx={{
                color: brand,
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: { xs: 19, md: 24 },
                fontWeight: 750,
                lineHeight: 1.05,
              }}
              noWrap
            >
              {store.name}
            </Typography>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: "center", mt: 0.35 }}
            >
              <VerifiedRounded sx={{ color: brand, fontSize: 15 }} />
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: 750 }}
                noWrap
              >
                Verified Xtiitch store
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <Stack
            component="nav"
            aria-label="Store navigation"
            direction="row"
            spacing={0.25}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            <Button href="#designs" sx={{ color: "text.primary" }}>
              Browse pieces
            </Button>
            <Button
              component={RouterLink}
              to="/cart"
              startIcon={<ShoppingBagRounded />}
              sx={{ color: "text.primary" }}
            >
              Cart
            </Button>
            <Button
              component={RouterLink}
              to="/track"
              sx={{ color: "text.primary" }}
            >
              Track order
            </Button>
            <Button
              component={RouterLink}
              to="/account"
              startIcon={<AccountCircleRounded />}
              sx={{ color: "text.primary" }}
            >
              Account
            </Button>
            <Button
              href="https://xtiitch.com"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "text.primary" }}
            >
              About Xtiitch
            </Button>
          </Stack>
          <ThemeModeToggle sx={{ color: "text.primary" }} />
          <StoreNavMenu />
        </Stack>
      </Container>
    </Box>
  );
}

function StoreHero({
  store,
  brand,
  onBrand,
  bannerURL,
  layout,
}: {
  store: StoreSummary;
  brand: string;
  onBrand: string;
  bannerURL: string;
  layout: string;
}) {
  const minimal = layout === "minimal";
  const spotlight = layout === "spotlight";
  const heroImage = bannerURL || fallbackHero;

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: minimal
          ? { xs: 310, md: 330 }
          : spotlight
            ? { xs: 430, md: 470 }
            : { xs: 360, md: 390 },
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        color: minimal ? onBrand : tokens.white,
        bgcolor: minimal ? brand : tokens.ink,
        backgroundImage: minimal ? "none" : `url("${heroImage}")`,
        backgroundSize: "cover",
        backgroundPosition: spotlight ? "center 38%" : "center",
        "&::before": minimal
          ? undefined
          : {
              content: '""',
              position: "absolute",
              inset: 0,
              bgcolor: alpha(tokens.ink, 0.48),
            },
      }}
    >
      <Container sx={{ position: "relative", zIndex: 1, py: { xs: 5, md: 6 } }}>
        <Box sx={{ maxWidth: { xs: 560, md: 660 } }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontSize: {
                xs: "2.7rem",
                md: spotlight ? "4.8rem" : "4.25rem",
              },
              lineHeight: 0.98,
              textShadow: minimal
                ? "none"
                : `0 3px 24px ${alpha(tokens.ink, 0.48)}`,
            }}
          >
            {store.name}
          </Typography>
          <Box
            sx={{
              width: 42,
              height: 3,
              bgcolor: minimal ? onBrand : brand,
              my: 2.25,
            }}
          />
          <Typography
            sx={{
              maxWidth: 520,
              fontSize: { xs: 17, md: 19 },
              lineHeight: 1.55,
            }}
          >
            Browse available pieces, choose a fit route, and start an order from
            the design that feels right.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.25}
            sx={{ mt: 3, alignItems: { xs: "stretch", sm: "center" } }}
          >
            <Button
              href="#designs"
              variant="contained"
              endIcon={<ArrowForwardRounded />}
              sx={{
                bgcolor: brand,
                color: onBrand,
                "&:hover": { bgcolor: brand, filter: "brightness(0.92)" },
              }}
            >
              Browse pieces
            </Button>
            <Button
              component={RouterLink}
              to="/track"
              variant="outlined"
              sx={{ color: "inherit", borderColor: "currentColor" }}
            >
              Track an order
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
