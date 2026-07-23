import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../theme";

type AdminSystemPageProps = {
  code?: string;
  eyebrow: string;
  title: string;
  message: string;
  actionLabel: string;
  actionHref?: string;
  reload?: boolean;
};

export function AdminSystemPage({
  code,
  eyebrow,
  title,
  message,
  actionLabel,
  actionHref,
  reload = false,
}: AdminSystemPageProps) {
  const actionProps = reload
    ? { type: "button" as const, onClick: () => window.location.reload() }
    : { href: actionHref ?? "/admin" };

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
        color: tokens.white,
        background: `linear-gradient(160deg, ${tokens.ink} 0%, ${tokens.charcoal} 64%, ${tokens.burgundy} 145%)`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${alpha(tokens.white, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.white, 0.045)} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(circle at 50% 42%, #000 0%, transparent 74%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 42%, #000 0%, transparent 74%)",
        }}
      />
      <Container sx={{ position: "relative", maxWidth: 680 }}>
        <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
          <Box
            sx={{
              width: 76,
              height: 76,
              borderRadius: "24px",
              display: "grid",
              placeItems: "center",
              color: tokens.white,
              bgcolor: alpha(tokens.burgundy, 0.9),
              border: `1px solid ${alpha(tokens.white, 0.16)}`,
              boxShadow: `0 26px 70px ${alpha(tokens.ink, 0.58)}`,
            }}
          >
            <AdminPanelSettingsRounded sx={{ fontSize: 36 }} />
          </Box>
          <Box>
            <Typography
              variant="overline"
              sx={{ color: alpha(tokens.white, 0.62), fontWeight: 900 }}
            >
              {eyebrow}
            </Typography>
            {code ? (
              <Typography
                aria-hidden
                sx={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: { xs: 82, md: 118 },
                  lineHeight: 0.9,
                  fontWeight: 800,
                  color: alpha(tokens.white, 0.11),
                }}
              >
                {code}
              </Typography>
            ) : null}
            <Typography
              variant="h1"
              component="h1"
              sx={{
                mt: code ? -0.5 : 1,
                color: tokens.white,
                fontSize: { xs: 34, md: 50 },
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                mt: 1.75,
                color: alpha(tokens.white, 0.72),
                maxWidth: 500,
                mx: "auto",
                fontSize: { xs: 16, md: 18 },
              }}
            >
              {message}
            </Typography>
          </Box>
          <Button
            {...actionProps}
            variant="contained"
            size="large"
            endIcon={reload ? <ReplayRounded /> : <ArrowForwardRounded />}
            sx={{ bgcolor: tokens.burgundy, whiteSpace: "nowrap" }}
          >
            {actionLabel}
          </Button>
          <Typography
            sx={{
              color: alpha(tokens.white, 0.42),
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Xtiitch operations
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export function SplashPage() {
  return (
    <AdminSystemPage
      eyebrow="Operations loading"
      title="Opening the admin console"
      message="Verification, payouts, subscriptions and support queues are being prepared."
      actionHref="/admin"
      actionLabel="Open console"
    />
  );
}
