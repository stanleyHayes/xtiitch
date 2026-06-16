import { type ReactNode } from "react";
import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import type { Design, StoreSummary } from "../lib/api";
import { priceLabel } from "../lib/format";
import { tokens } from "../theme";

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

export function StoreHeader({
  store,
  children,
}: {
  store: StoreSummary;
  children?: ReactNode;
}) {
  const brand = store.brand_color || "#800020";
  const onBrand = contrastText(brand);
  return (
    <Box
      component="header"
      sx={{
        bgcolor: brand,
        color: onBrand,
        position: "relative",
        overflow: "hidden",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: "auto -15% -70% auto",
          width: 360,
          height: 360,
          borderRadius: "50%",
          border: `1px solid ${alpha(onBrand, 0.18)}`,
        },
      }}
    >
      <Container sx={{ py: { xs: 4, md: 6 } }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", mb: 1 }}
        >
          <Typography variant="h3" component="h1">
            {store.name}
          </Typography>
          <VerifiedRounded
            sx={{ opacity: 0.85 }}
            titleAccess="Verified Xtiitch store"
          />
        </Stack>
        <Typography sx={{ opacity: 0.85 }}>
          {store.handle}.xtiitch.com
        </Typography>
        {children}
      </Container>
    </Box>
  );
}

function StoreBrowseRail({
  store,
  designs,
  query,
}: {
  store: StoreSummary;
  designs: Design[];
  query: string;
}) {
  const brand = store.brand_color || tokens.burgundy;
  const onBrand = contrastText(brand);
  const customisableCount = designs.filter(
    (design) => design.customisation_allowed,
  ).length;
  const pricedCount = designs.filter(
    (design) => design.prices.length > 0,
  ).length;
  const services = [
    {
      label: "Bespoke",
      active: store.settings.bespoke_enabled,
      helper: "Custom orders",
    },
    {
      label: "Measurements",
      active: store.settings.measurements_enabled,
      helper: "Fit details",
    },
    {
      label: "Delivery",
      active:
        store.settings.delivery_enabled || store.settings.dispatch_enabled,
      helper: "Handover options",
    },
    {
      label: "Collections",
      active: store.settings.collections_enabled,
      helper: "Grouped drops",
    },
  ];

  return (
    <Box
      component="aside"
      sx={{
        position: { xs: "sticky", lg: "fixed" },
        top: { xs: 0, lg: 24 },
        left: { lg: 24 },
        zIndex: 10,
        width: { lg: 320 },
        height: { lg: "calc(100vh - 48px)" },
        maxHeight: { lg: "calc(100vh - 48px)" },
        overflowX: { xs: "auto", lg: "hidden" },
        overflowY: { lg: "auto" },
        border: "1px solid",
        borderColor: alpha(brand, 0.2),
        borderRadius: { xs: 0, lg: "8px" },
        bgcolor: alpha(tokens.white, 0.98),
        backdropFilter: "blur(14px)",
        boxShadow: { lg: `18px 0 70px ${alpha(tokens.ink, 0.14)}` },
        backgroundImage: `
          linear-gradient(${alpha(brand, 0.04)} 1px, transparent 1px),
          linear-gradient(90deg, ${alpha(brand, 0.04)} 1px, transparent 1px)
        `,
        backgroundSize: "32px 32px",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: {
            xs: "storeRailDrop 320ms ease both",
            lg: "storeRailSlide 520ms cubic-bezier(.2,.8,.2,1) both",
          },
        },
      }}
    >
      <Stack
        spacing={{ xs: 1, lg: 1.5 }}
        sx={{
          p: { xs: 1.25, lg: 1.5 },
          minWidth: { xs: 980, lg: "auto" },
          minHeight: { lg: "100%" },
        }}
      >
        <Box
          sx={{
            p: 1.35,
            borderRadius: "8px",
            bgcolor: brand,
            color: onBrand,
            position: "relative",
            overflow: "hidden",
            minWidth: { xs: 270, lg: "auto" },
            boxShadow: `0 18px 48px ${alpha(brand, 0.22)}`,
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              right: -16,
              top: -22,
              color: alpha(onBrand, 0.12),
              transform: "rotate(-8deg)",
              "& .MuiSvgIcon-root": { fontSize: 118 },
            }}
          >
            <StorefrontOutlined />
          </Box>
          <Stack
            direction="row"
            spacing={1.1}
            sx={{ position: "relative", alignItems: "center" }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "8px",
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(onBrand, 0.14),
                border: "1px solid",
                borderColor: alpha(onBrand, 0.18),
                flexShrink: 0,
              }}
            >
              <StorefrontOutlined />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900 }} noWrap>
                {store.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ opacity: 0.76, fontWeight: 800 }}
                noWrap
              >
                {store.handle}.xtiitch.com
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ position: "relative", mt: 1.25, flexWrap: "wrap" }}
          >
            <Chip
              size="small"
              icon={<VerifiedRounded />}
              label="Verified store"
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
              label={`${designs.length} pieces`}
              sx={{
                color: onBrand,
                bgcolor: alpha(onBrand, 0.12),
                border: "1px solid",
                borderColor: alpha(onBrand, 0.18),
              }}
            />
          </Stack>
        </Box>

        <Box sx={{ minWidth: { xs: 280, lg: "auto" } }}>
          <Typography
            variant="caption"
            sx={{
              display: { xs: "none", lg: "block" },
              mb: 0.75,
              color: "text.secondary",
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Find a design
          </Typography>
          <Form method="get" role="search">
            <TextField
              name="q"
              defaultValue={query}
              placeholder="Search designs"
              size="small"
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
                "& .MuiOutlinedInput-root": {
                  bgcolor: tokens.white,
                  boxShadow: `0 8px 22px ${alpha(tokens.ink, 0.05)}`,
                },
              }}
            />
          </Form>
        </Box>

        <Divider sx={{ display: { xs: "none", lg: "block" } }} />

        <Box sx={{ minWidth: { xs: 330, lg: "auto" } }}>
          <Typography
            variant="caption"
            sx={{
              display: { xs: "none", lg: "block" },
              mb: 0.75,
              color: "text.secondary",
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Store signals
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 0.75,
              gridTemplateColumns: {
                xs: "repeat(3, 1fr)",
                lg: "repeat(2, 1fr)",
              },
            }}
          >
            {[
              { label: "Priced", value: String(pricedCount) },
              { label: "Custom", value: String(customisableCount) },
              {
                label: "Delivery",
                value:
                  store.settings.delivery_enabled ||
                  store.settings.dispatch_enabled
                    ? "On"
                    : "Ask",
              },
            ].map((signal) => (
              <Box
                key={signal.label}
                sx={{
                  p: 1,
                  border: "1px solid",
                  borderColor: alpha(brand, 0.16),
                  borderRadius: "8px",
                  bgcolor: alpha(brand, 0.045),
                  minWidth: 0,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 900 }}
                >
                  {signal.label}
                </Typography>
                <Typography sx={{ fontWeight: 900, overflowWrap: "anywhere" }}>
                  {signal.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ minWidth: { xs: 360, lg: "auto" } }}>
          <Typography
            variant="caption"
            sx={{
              display: { xs: "none", lg: "block" },
              mb: 0.75,
              color: "text.secondary",
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Services
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 0.75,
              gridTemplateColumns: { xs: "repeat(4, 1fr)", lg: "1fr" },
            }}
          >
            {services.map((service) => (
              <Box
                key={service.label}
                sx={{
                  p: 1,
                  border: "1px solid",
                  borderColor: service.active ? alpha(brand, 0.22) : "divider",
                  borderRadius: "8px",
                  bgcolor: service.active
                    ? alpha(brand, 0.06)
                    : alpha(tokens.ink, 0.025),
                  minWidth: 0,
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {service.label}
                  </Typography>
                  <Box
                    aria-hidden
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: service.active ? brand : alpha(tokens.ink, 0.25),
                      flexShrink: 0,
                    }}
                  />
                </Stack>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary" }}
                  noWrap
                >
                  {service.helper}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Stack
          direction={{ xs: "row", lg: "column" }}
          spacing={0.75}
          sx={{ mt: "auto", minWidth: { xs: 270, lg: "auto" } }}
        >
          <Button
            href="#designs"
            variant="contained"
            endIcon={<ArrowForwardRounded />}
            sx={{ bgcolor: brand, color: onBrand }}
          >
            Browse designs
          </Button>
          <Button href="https://xtiitch.com" variant="outlined">
            About Xtiitch
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

// StoreView is the full storefront page — header, in-store search, and the
// design grid. It is rendered both at <handle>.xtiitch.com (the home route
// resolving the store from the subdomain) and at the legacy /store/:handle path.
export function StoreView({
  store,
  designs,
  query,
}: {
  store: StoreSummary;
  designs: Design[];
  query: string;
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        "@keyframes storeRailSlide": {
          from: { opacity: 0, transform: "translateX(-16px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "@keyframes storeRailDrop": {
          from: { opacity: 0, transform: "translateY(-10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes storeSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      <StoreBrowseRail store={store} designs={designs} query={query} />
      <Box
        sx={{
          ml: { lg: "344px" },
          minWidth: 0,
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "storeSurfaceIn 500ms ease both",
          },
        }}
      >
        <StoreHeader store={store} />

        <Container id="designs" sx={{ py: { xs: 4, md: 6 } }}>
          {query ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 3, alignItems: "center" }}
            >
              <Typography variant="h6" component="h2">
                Results for “{query}”
              </Typography>
              <Chip size="small" label={`${designs.length}`} />
            </Stack>
          ) : (
            <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
              All designs
            </Typography>
          )}
          <DesignGrid designs={designs} />
        </Container>
      </Box>
    </Box>
  );
}

function DesignImage({ design }: { design: Design }) {
  const first = design.images[0];
  if (first) {
    return (
      <CardMedia
        component="img"
        image={first}
        alt={design.title}
        sx={{ aspectRatio: "4 / 5", objectFit: "cover" }}
      />
    );
  }
  return (
    <Box
      aria-hidden
      sx={{
        aspectRatio: "4 / 5",
        display: "grid",
        placeItems: "center",
        bgcolor: "rgba(128,0,32,0.08)",
        color: "primary.main",
        fontWeight: 800,
        fontSize: 40,
      }}
    >
      {design.title.slice(0, 1).toUpperCase()}
    </Box>
  );
}

export function DesignCard({
  design,
  index = 0,
}: {
  design: Design;
  index?: number;
}) {
  return (
    <Card
      sx={{
        height: "100%",
        overflow: "hidden",
        transition:
          "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "storeSurfaceIn 420ms ease both",
          animationDelay: `${Math.min(index, 8) * 40}ms`,
        },
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 18px 45px ${alpha(tokens.ink, 0.1)}`,
          borderColor: alpha(tokens.burgundy, 0.22),
        },
      }}
    >
      <CardActionArea
        component={RouterLink}
        to={`/d/${design.handle}`}
        sx={{ height: "100%" }}
      >
        <DesignImage design={design} />
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
            {design.title}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}
          >
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={priceLabel(design.prices)}
            />
            {design.customisation_allowed ? (
              <Chip size="small" variant="outlined" label="Customisable" />
            ) : null}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function DesignGrid({ designs }: { designs: Design[] }) {
  if (designs.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography variant="h6" sx={{ color: "text.secondary" }}>
          Nothing to show here yet.
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: {
          xs: "1fr 1fr",
          sm: "repeat(3, 1fr)",
          md: "repeat(4, 1fr)",
        },
      }}
    >
      {designs.map((design, index) => (
        <DesignCard key={design.design_id} design={design} index={index} />
      ))}
    </Box>
  );
}
