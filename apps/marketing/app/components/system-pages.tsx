import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import HomeRounded from "@mui/icons-material/HomeRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../theme";

type SystemPageProps = {
  code?: string;
  eyebrow: string;
  title: string;
  message: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function MarketingSystemPage({
  code,
  eyebrow,
  title,
  message,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: SystemPageProps) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "82vh",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        py: { xs: 8, md: 10 },
        bgcolor: "background.default",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.8,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.07)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.07)} 1px, transparent 1px)`,
          backgroundSize: "34px 34px",
          maskImage:
            "radial-gradient(circle at 50% 46%, #000 0%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 46%, #000 0%, transparent 72%)",
        }}
      />
      <Container sx={{ position: "relative", maxWidth: 720 }}>
        <Stack
          spacing={3.5}
          sx={{ alignItems: "center", textAlign: "center" }}
        >
          <Box
            sx={{
              width: 82,
              height: 82,
              borderRadius: "28px",
              display: "grid",
              placeItems: "center",
              color: tokens.burgundy,
              bgcolor: alpha(tokens.burgundy, 0.08),
              border: `1px solid ${alpha(tokens.burgundy, 0.14)}`,
              boxShadow: `0 24px 70px ${alpha(tokens.burgundy, 0.14)}`,
            }}
          >
            <AutoAwesomeRounded sx={{ fontSize: 34 }} />
          </Box>
          <Box>
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
                  mt: 0.5,
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: { xs: 86, md: 126 },
                  fontWeight: 800,
                  lineHeight: 0.9,
                  color: alpha(tokens.burgundy, 0.13),
                }}
              >
                {code}
              </Typography>
            ) : null}
            <Typography
              variant="h1"
              component="h1"
              sx={{
                mt: code ? -1 : 1,
                fontSize: { xs: 38, md: 58 },
                maxWidth: 660,
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                mt: 2,
                color: "text.secondary",
                maxWidth: 540,
                mx: "auto",
                fontSize: { xs: 17, md: 19 },
              }}
            >
              {message}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            <Button
              href={primaryHref}
              variant="contained"
              size="large"
              startIcon={<HomeRounded />}
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
      </Container>
    </Box>
  );
}

export function SplashPage() {
  return (
    <MarketingSystemPage
      eyebrow="Xtiitch is loading"
      title="Opening the atelier"
      message="We are preparing the storefronts, plan details and customer paths so the next screen lands cleanly."
      primaryHref="/"
      primaryLabel="Go home"
      secondaryHref="/features"
      secondaryLabel="View features"
    />
  );
}
