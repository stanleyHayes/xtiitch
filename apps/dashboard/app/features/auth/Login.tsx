import type { MetaFunction } from "react-router";
import { useActionData, useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import { LoginForm } from "./LoginForm";
import { tokens } from "../../theme";
import type { Route } from "../../routes/+types/login";

export const meta: MetaFunction = () => [
  { title: "Sign in | Xtiitch" },
  { name: "description", content: "Sign in to your Xtiitch workspace." },
];

export default function Login(_props: Route.ComponentProps) {
  const result = (useActionData() ?? {}) as {
    error?: string;
    mfaRequired?: boolean;
    otpSent?: boolean;
  };
  const branding = useRouteLoaderData("root") as
    | { brandLogoUrl?: string }
    | undefined;
  const brandLogoUrl = branding?.brandLogoUrl ?? "";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px)`,
        backgroundSize: "34px 34px",
      }}
    >
      <Container
        sx={{
          minHeight: "100vh",
          display: "grid",
          alignItems: "center",
          py: { xs: 4, md: 7 },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, lg: 5 },
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 430px" },
            alignItems: "stretch",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.1),
              borderRadius: 2,
              bgcolor: tokens.charcoal,
              color: "common.white",
              overflow: "hidden",
              position: "relative",
              minHeight: { xs: "auto", lg: 620 },
              display: { xs: "none", lg: "flex" },
              flexDirection: "column",
              justifyContent: "space-between",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: "auto -12% -22% auto",
                width: 340,
                height: 340,
                borderRadius: "50%",
                border: `1px solid ${alpha(tokens.gold, 0.34)}`,
              },
            }}
          >
            <Box sx={{ position: "relative", zIndex: 1 }}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                {brandLogoUrl ? (
                  <Box
                    component="img"
                    src={brandLogoUrl}
                    alt="Xtiitch"
                    sx={{
                      height: 36,
                      width: "auto",
                      maxWidth: 160,
                      objectFit: "contain",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Box
                    component="img"
                    src="/favicon.svg"
                    alt="Xtiitch"
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      flexShrink: 0,
                      display: "block",
                    }}
                  />
                )}
                <Box>
                  {brandLogoUrl ? null : (
                    <Typography sx={{ fontWeight: 800, lineHeight: 1 }}>
                      Xtiitch
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    sx={{ color: alpha(tokens.white, 0.66) }}
                  >
                    Business dashboard
                  </Typography>
                </Box>
              </Stack>
              <Typography
                variant="h3"
                component="h1"
                sx={{ mt: { xs: 4, md: 7 }, maxWidth: 620 }}
              >
                Run orders, fittings, payments, and catalogue work from one calm
                desk.
              </Typography>
              <Typography
                sx={{
                  mt: 2,
                  color: alpha(tokens.white, 0.72),
                  maxWidth: 560,
                  fontSize: 17,
                }}
              >
                Built for fashion studios that need quick answers: what is paid,
                what is being made, and who needs a call next.
              </Typography>
            </Box>
            <Box sx={{ position: "relative", zIndex: 1, mt: { xs: 4, md: 6 } }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
              >
                {[
                  { icon: <TimelineRounded />, label: "Stage tracking" },
                  { icon: <PaymentsRounded />, label: "Paystack rails" },
                  { icon: <ShieldRounded />, label: "Tenant scoped" },
                ].map((item) => (
                  <Chip
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    sx={{
                      justifyContent: "flex-start",
                      color: "common.white",
                      bgcolor: alpha(tokens.white, 0.1),
                      border: "1px solid",
                      borderColor: alpha(tokens.white, 0.14),
                      "& .MuiChip-icon": { color: alpha(tokens.white, 0.82) },
                    }}
                  />
                ))}
              </Stack>
              <Divider
                sx={{ my: 3, borderColor: alpha(tokens.white, 0.12) }}
              />
              <Typography
                variant="body2"
                sx={{ color: alpha(tokens.white, 0.62) }}
              >
                Access is protected with an httpOnly session cookie. Re-login
                when the API rejects an expired token.
              </Typography>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.12),
              borderRadius: 3,
              alignSelf: "center",
              bgcolor: alpha(tokens.white, 0.98),
              color: tokens.ink,
              boxShadow: `0 28px 72px ${alpha(tokens.ink, 0.16)}`,
              "& .MuiTypography-root": {
                color: "inherit",
              },
              "& .MuiTypography-colorTextSecondary": {
                color: alpha(tokens.ink, 0.68),
              },
              "& .MuiInputLabel-root": {
                color: alpha(tokens.ink, 0.68),
                bgcolor: alpha(tokens.white, 0.98),
                px: 0.75,
                ml: -0.75,
                borderRadius: 1,
                "&.Mui-focused": {
                  color: tokens.burgundy,
                },
              },
              "& .MuiOutlinedInput-root": {
                bgcolor: tokens.white,
                color: tokens.ink,
                borderRadius: 2,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: alpha(tokens.ink, 0.22),
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: alpha(tokens.burgundy, 0.5),
                },
                "&.Mui-focused": {
                  boxShadow: `0 0 0 4px ${alpha(tokens.burgundy, 0.12)}`,
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: tokens.burgundy,
                  },
                },
              },
              "& .MuiInputAdornment-root, & .MuiSvgIcon-root": {
                color: alpha(tokens.ink, 0.62),
              },
              "& input::placeholder": {
                color: alpha(tokens.ink, 0.48),
                opacity: 1,
              },
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              sx={{
                display: { xs: "flex", lg: "none" },
                alignItems: "center",
                mb: 2.5,
              }}
            >
              {brandLogoUrl ? (
                <Box
                  component="img"
                  src={brandLogoUrl}
                  alt="Xtiitch"
                  sx={{
                    height: 32,
                    width: "auto",
                    maxWidth: 150,
                    objectFit: "contain",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: tokens.burgundy,
                    color: tokens.white,
                  }}
                >
                  <StorefrontRounded />
                </Box>
              )}
              <Box>
                {brandLogoUrl ? null : (
                  <Typography sx={{ fontWeight: 800, lineHeight: 1 }}>
                    Xtiitch
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{ color: alpha(tokens.ink, 0.68) }}
                >
                  Business dashboard
                </Typography>
              </Box>
            </Stack>
            <LoginForm result={result} />
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
