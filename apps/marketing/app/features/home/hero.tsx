import { Link as RouterLink, useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import { site } from "../../content";

const homeRiseSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

const heroSignals = [
  { label: "Store link opened", detail: "Design viewed", color: "#faf6f2" },
  { label: "Order paid", detail: "Paystack checkout", color: "#b87914" },
  { label: "Tracking shared", detail: "Yellow: being made", color: "#237a4b" },
] as const;

export function Hero() { // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  // Self-serve signup URL (the business dashboard's /register, a separate
  // origin) comes from the root loader.
  const rootData = useRouteLoaderData("root") as
    | { signupUrl?: string }
    | undefined;
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: "calc(100svh - 180px)", md: "calc(100svh - 210px)" },
        display: "grid",
        alignItems: "center",
        overflow: "hidden",
        bgcolor: "secondary.main",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        component="img"
        src="/images/atelier-hero.webp"
        alt=""
        aria-hidden
        decoding="async"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: { xs: "62% center", md: "center" },
          transform: "scale(1.035)",
          animation: "xtiitch-hero-zoom 1400ms ease-out both",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            transform: "none",
          },
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: { xs: "-12% -38% 12% -28%", md: "-18% -24% 8% -18%" },
          zIndex: 1,
          opacity: 0.74,
          filter: "blur(6px)",
          background:
            "radial-gradient(circle at 18% 68%, rgba(128,0,32,0.48), transparent 36%), radial-gradient(circle at 74% 22%, rgba(184,121,20,0.34), transparent 30%), radial-gradient(circle at 56% 78%, rgba(250,246,242,0.16), transparent 28%)",
          animation: "xtiitch-spotlight-drift 16s ease-in-out infinite",
          pointerEvents: "none",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
          },
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "linear-gradient(90deg, rgba(21,17,26,0.9) 0%, rgba(21,17,26,0.66) 44%, rgba(21,17,26,0.2) 78%), linear-gradient(180deg, rgba(128,0,32,0.22), rgba(21,17,26,0.58))",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px, 44px 44px",
          opacity: 0.16,
          animation: "xtiitch-thread-drift 30s linear infinite",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
          },
        }}
      />
      <Container sx={{ position: "relative", zIndex: 4, py: { xs: 5, md: 8 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 720px) 360px" },
            gap: { xs: 4, lg: 7 },
            alignItems: "end",
          }}
        >
          <Box sx={{ maxWidth: 720, color: "common.white" }}>
            <Box
              sx={{
                mb: 3,
                display: "inline-flex",
                alignItems: "center",
                gap: 1.25,
                py: 0.75,
                pr: 2,
                pl: 0.75,
                border: "1px solid rgba(255,255,255,0.24)",
                borderRadius: 999,
                bgcolor: "rgba(21,17,26,0.52)",
                boxShadow: "0 12px 34px rgba(0,0,0,0.2)",
                backdropFilter: "blur(14px)",
                ...homeRiseSx(80),
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  bgcolor: "rgba(250,246,242,0.14)",
                  color: "#f1c46b",
                }}
              >
                <LocationOnRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="span"
                  sx={{
                    display: "block",
                    color: "#f1c46b",
                    fontSize: 10,
                    lineHeight: 1.2,
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  Built in Ghana
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    display: "block",
                    mt: 0.25,
                    color: "common.white",
                    fontSize: { xs: 13, sm: 14 },
                    lineHeight: 1.2,
                    fontWeight: 750,
                    whiteSpace: "nowrap",
                  }}
                >
                  For fashion businesses
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: { xs: 40, sm: 52, md: 72 },
                lineHeight: 0.98,
                maxWidth: "100%",
                overflowWrap: "break-word",
                ...homeRiseSx(160),
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "inline", sm: "none" } }}
              >
                A real shop for fashion businesses.
              </Box>{" "}
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                A real shop, run simply — and an answer to{" "}
                <Box component="span" sx={{ color: "rgba(255,255,255,0.86)" }}>
                  “where is my cloth?”
                </Box>
              </Box>
            </Typography>
            <Typography
              sx={{
                mt: 3,
                fontSize: { xs: 17, md: 20 },
                color: "rgba(255,255,255,0.82)",
                maxWidth: 620,
                ...homeRiseSx(240),
              }}
            >
              {site.promise}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                mt: 4,
                alignItems: { xs: "stretch", sm: "center" },
                ...homeRiseSx(320),
              }}
            >
              <Button
                component="a"
                href={signupUrl}
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{
                  bgcolor: "common.white",
                  color: "primary.main",
                  "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.9)" },
                }}
              >
                {site.primaryCta.label}
              </Button>
              <Button
                component={RouterLink}
                to={site.secondaryCta.href}
                size="large"
                variant="outlined"
                sx={{
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.62)",
                  "&:hover": {
                    borderColor: "common.white",
                    bgcolor: "rgba(var(--surface-rgb), 0.08)",
                  },
                }}
              >
                {site.secondaryCta.label}
              </Button>
            </Stack>
            <Typography
              variant="body2"
              sx={{
                mt: 2.5,
                color: "rgba(255,255,255,0.76)",
                ...homeRiseSx(400),
              }}
            >
              Start free. Take mobile money and cards through Paystack. Keep
              your own money.
            </Typography>
          </Box>
          <Box
            aria-label="Example order flow"
            sx={{
              display: { xs: "none", lg: "block" },
              position: "relative",
              p: 2,
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 1,
              bgcolor: "rgba(21,17,26,0.48)",
              color: "common.white",
              backdropFilter: "blur(16px)",
              boxShadow: "0 36px 86px -54px rgba(0,0,0,0.8)",
              ...homeRiseSx(420),
              "&:before": {
                content: '""',
                position: "absolute",
                inset: 10,
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.12)",
                pointerEvents: "none",
              },
            }}
          >
            <Typography
              component="p"
              sx={{
                position: "relative",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0,
                color: "rgba(255,255,255,0.64)",
              }}
            >
              Live order path
            </Typography>
            <Stack spacing={1.25} sx={{ position: "relative", mt: 2 }}>
              {heroSignals.map((signal, index) => (
                <Box
                  key={signal.label}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 1.25,
                    alignItems: "center",
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor:
                      index === 1
                        ? "rgba(255,255,255,0.14)"
                        : "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: `${signal.color}24`,
                      color: signal.color,
                    }}
                  >
                    <CheckCircleRoundedIcon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                      {signal.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(255,255,255,0.68)" }}
                    >
                      {signal.detail}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
            <Box
              sx={{
                position: "relative",
                mt: 1.5,
                px: 1.5,
                py: 1.25,
                borderRadius: 1,
                bgcolor: "rgba(128,0,32,0.58)",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                Customer asks less. Studio answers faster.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
