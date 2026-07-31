import { Link as RouterLink } from "react-router";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";
import { ThemeModeToggle } from "../../theme-mode";
import { PoweredByBadge } from "./powered-by-badge";
import { readableBrandText, resolveStoreBrand } from "./store-brand";
import { XtiitchPlatformLogo } from "./platform-logo";

const MARKETPLACE_URL = "https://store.xtiitch.com";

export function NotLiveStoreView({ store }: { store: StoreSummary }) {
  const brand = resolveStoreBrand(store.brand_color);
  const onBrand = readableBrandText(brand);
  const logoURL = store.settings.logo_url?.trim() ?? "";
  const monogram = store.name.trim().charAt(0).toUpperCase() || "S";

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        color: "text.primary",
        backgroundImage: `
          radial-gradient(ellipse 70% 55% at 100% 0%, ${alpha(brand, 0.18)}, transparent 58%),
          radial-gradient(ellipse 50% 40% at 0% 100%, ${alpha(tokens.ink, 0.06)}, transparent 55%),
          linear-gradient(${alpha(brand, 0.035)} 1px, transparent 1px),
          linear-gradient(90deg, ${alpha(brand, 0.035)} 1px, transparent 1px)
        `,
        backgroundSize: "auto, auto, 48px 48px, 48px 48px",
        "@keyframes notLiveIn": {
          from: { opacity: 0, transform: "translateY(14px)" },
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
      <NotLiveBar brand={brand} />
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "grid",
          alignItems: "center",
          py: { xs: 5, md: 7 },
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "notLiveIn 560ms cubic-bezier(0.22, 1, 0.36, 1) both",
          },
        }}
      >
        <Container
          sx={{
            display: "grid",
            gap: { xs: 5, md: 7 },
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            },
            alignItems: "center",
          }}
        >
          <NotLiveCopy
            brand={brand}
            onBrand={onBrand}
            handle={store.handle}
            storeName={store.name}
          />
          <NotLiveVisual
            brand={brand}
            onBrand={onBrand}
            logoURL={logoURL}
            monogram={monogram}
            storeName={store.name}
          />
        </Container>
      </Box>
      <PoweredByBadge brand={brand} />
    </Box>
  );
}

function NotLiveCopy({
  brand,
  onBrand,
  handle,
  storeName,
}: {
  brand: string;
  onBrand: string;
  handle: string;
  storeName: string;
}) {
  return (
    <Stack spacing={{ xs: 2.5, md: 3 }} sx={{ maxWidth: 560 }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.85,
          alignSelf: "flex-start",
          px: 1.25,
          py: 0.65,
          borderRadius: 999,
          border: "1px solid",
          borderColor: alpha(brand, 0.28),
          bgcolor: alpha(brand, 0.08),
          color: brand,
        }}
      >
        <ScheduleRounded sx={{ fontSize: 16 }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, letterSpacing: 0.04 }}
        >
          Opening soon
        </Typography>
      </Box>
      <Box>
        <Typography
          component="p"
          sx={{
            mb: 1,
            color: "text.secondary",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.08,
            textTransform: "uppercase",
          }}
        >
          {handle}.xtiitch.com
        </Typography>
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: { xs: 42, sm: 56, md: 68 },
            lineHeight: 0.96,
            letterSpacing: -1.2,
            maxWidth: "11ch",
          }}
        >
          {storeName}
        </Typography>
      </Box>
      <Typography
        sx={{
          color: "text.secondary",
          fontSize: { xs: 17, md: 18 },
          lineHeight: 1.55,
          maxWidth: "42ch",
        }}
      >
        This atelier has not opened its storefront yet. Browse other studios on
        Xtiitch, or come back when the first pieces land.
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        sx={{ pt: 0.5 }}
      >
        <Button
          href={MARKETPLACE_URL}
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRounded />}
          sx={{
            bgcolor: brand,
            color: onBrand,
            px: 2.5,
            "&:hover": { bgcolor: brand, filter: "brightness(0.94)" },
            "&:active": { transform: "scale(0.98)" },
          }}
        >
          Explore studios
        </Button>
        <Button
          component={RouterLink}
          to="/track"
          variant="outlined"
          size="large"
          sx={{
            borderColor: alpha(tokens.ink, 0.18),
            color: "text.primary",
            "&:hover": { borderColor: brand, bgcolor: alpha(brand, 0.05) },
            "&:active": { transform: "scale(0.98)" },
          }}
        >
          Track an order
        </Button>
      </Stack>
    </Stack>
  );
}

function NotLiveBar({ brand }: { brand: string }) {
  return (
    <Box
      component="header"
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(var(--surface-rgb), 0.84)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Container
        sx={{
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack
          component="a"
          href="https://xtiitch.com"
          target="_blank"
          rel="noopener noreferrer"
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
            minWidth: 0,
          }}
        >
          <XtiitchPlatformLogo color={brand} size={26} />
          <Typography sx={{ fontWeight: 800, letterSpacing: -0.2 }} noWrap>
            Xtiitch
          </Typography>
        </Stack>
        <ThemeModeToggle
          sx={{
            width: 40,
            height: 40,
            p: 0,
            color: "text.primary",
            borderRadius: 1.5,
          }}
        />
      </Container>
    </Box>
  );
}

function NotLiveVisual({
  brand,
  onBrand,
  logoURL,
  monogram,
  storeName,
}: {
  brand: string;
  onBrand: string;
  logoURL: string;
  monogram: string;
  storeName: string;
}) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        minHeight: { xs: 280, md: 420 },
        borderRadius: { xs: 3, md: 4 },
        overflow: "hidden",
        bgcolor: alpha(brand, 0.1),
        border: "1px solid",
        borderColor: alpha(brand, 0.16),
        boxShadow: `0 28px 60px ${alpha(tokens.ink, 0.1)}`,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(145deg, ${alpha(brand, 0.22)}, transparent 46%),
            linear-gradient(320deg, ${alpha(tokens.ink, 0.12)}, transparent 50%)
          `,
        }}
      />
      <Box
        component="img"
        src="/images/storefront-dress-form.png"
        alt=""
        sx={{
          position: "absolute",
          right: { xs: -18, md: -8 },
          bottom: { xs: -28, md: -36 },
          width: { xs: "68%", md: "72%" },
          maxWidth: 360,
          opacity: 0.22,
          filter: "grayscale(0.2)",
          pointerEvents: "none",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "notLiveIn 720ms 80ms cubic-bezier(0.22, 1, 0.36, 1) both",
          },
        }}
      />
      <Stack
        spacing={2}
        sx={{
          position: "relative",
          height: "100%",
          minHeight: { xs: 280, md: 420 },
          p: { xs: 3, md: 4 },
          justifyContent: "space-between",
        }}
      >
        <Box
          sx={{
            width: { xs: 88, md: 108 },
            height: { xs: 88, md: 108 },
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            color: onBrand,
            bgcolor: brand,
            boxShadow: `0 18px 36px ${alpha(brand, 0.35)}`,
          }}
        >
          {logoURL ? (
            <Box
              component="img"
              src={logoURL}
              alt=""
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                bgcolor: tokens.white,
              }}
            />
          ) : (
            <Typography
              sx={{
                fontFamily: (theme) => theme.typography.h1.fontFamily,
                fontSize: { xs: 42, md: 52 },
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {monogram}
            </Typography>
          )}
        </Box>
        <Box>
          <Typography
            sx={{
              color: "text.secondary",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 0.12,
              textTransform: "uppercase",
              mb: 0.75,
            }}
          >
            Storefront closed
          </Typography>
          <Typography
            sx={{
              fontFamily: (theme) => theme.typography.h1.fontFamily,
              fontSize: { xs: 28, md: 36 },
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -0.6,
              maxWidth: "12ch",
            }}
          >
            {storeName}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
