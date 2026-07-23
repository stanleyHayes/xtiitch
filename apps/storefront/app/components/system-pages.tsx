import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../theme";

type StorefrontSystemPageProps = {
  code?: string;
  eyebrow: string;
  title: string;
  message: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function StorefrontSystemPage({
  code,
  eyebrow,
  title,
  message,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: StorefrontSystemPageProps) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: { xs: 6, md: 8 },
        bgcolor: "background.default",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
          maskImage:
            "linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)",
        }}
      />
      <Container sx={{ position: "relative", maxWidth: 760 }}>
        <Box
          sx={{
            border: `1px solid ${alpha(tokens.burgundy, 0.16)}`,
            borderRadius: 8,
            overflow: "hidden",
            bgcolor: "background.paper",
            boxShadow: `0 30px 90px ${alpha(tokens.ink, 0.12)}`,
          }}
        >
          <Box
            sx={{
              minHeight: 148,
              display: "grid",
              placeItems: "center",
              color: tokens.white,
              background: `linear-gradient(135deg, ${tokens.ink}, ${tokens.burgundy})`,
            }}
          >
            <StorefrontRounded sx={{ fontSize: 48 }} />
          </Box>
          <Stack spacing={2.5} sx={{ p: { xs: 3, sm: 5 }, textAlign: "center" }}>
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 900 }}
            >
              {eyebrow}
            </Typography>
            {code ? (
              <Typography
                aria-hidden
                sx={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: { xs: 72, md: 104 },
                  lineHeight: 0.9,
                  fontWeight: 800,
                  color: alpha(tokens.burgundy, 0.13),
                }}
              >
                {code}
              </Typography>
            ) : null}
            <Typography
              variant="h1"
              component="h1"
              sx={{ fontSize: { xs: 34, md: 48 }, lineHeight: 1.04 }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                maxWidth: 520,
                mx: "auto",
                fontSize: { xs: 16, md: 18 },
              }}
            >
              {message}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "center", pt: 1 }}
            >
              <Button
                href={primaryHref}
                variant="contained"
                size="large"
                startIcon={<ArrowBackRounded />}
                sx={{ whiteSpace: "nowrap" }}
              >
                {primaryLabel}
              </Button>
              {secondaryHref && secondaryLabel ? (
                <Button
                  href={secondaryHref}
                  variant="outlined"
                  size="large"
                  startIcon={<SearchRounded />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {secondaryLabel}
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

export function SplashPage() {
  return (
    <StorefrontSystemPage
      eyebrow="Storefront loading"
      title="Preparing your shop view"
      message="We are getting the studio, designs, cart and tracking details ready."
      primaryHref="/"
      primaryLabel="Go home"
      secondaryHref="/discover"
      secondaryLabel="Browse studios"
    />
  );
}
