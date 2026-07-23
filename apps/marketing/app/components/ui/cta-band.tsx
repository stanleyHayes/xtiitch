import { Link as RouterLink, useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { site } from "../../content";
import { riseInSx } from "./shared";

// eslint-disable-next-line max-lines-per-function -- large presentational component; refactor in follow-up
export function CtaBand({
  title,
  body,
  image,
}: {
  title: string;
  body: string;
  image: string;
}) {
  const rootData = useRouteLoaderData("root") as
    | { signupUrl?: string }
    | undefined;
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      <Box
        component="img"
        src={image}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.18,
          transform: "scale(1.03)",
          animation: "xtiitch-hero-zoom 1200ms ease-out both",
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
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.95), rgba(21,17,26,0.84))",
        }}
      />
      <Container sx={{ position: "relative", py: { xs: 6, md: 9 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 5 },
            gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
            alignItems: "center",
          }}
        >
          <Box sx={riseInSx(40)}>
            <Typography variant="h2" component="h2" sx={{ maxWidth: 760 }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 2, maxWidth: 620, opacity: 0.9 }}>
              {body}
            </Typography>
          </Box>
          <Box
            sx={{
              width: { xs: "100%", md: 360 },
              p: { xs: 1.5, sm: 2 },
              border: "1px solid",
              borderColor: "rgba(255,255,255,0.24)",
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.08)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 28px 80px -56px rgba(0,0,0,0.78)",
              ...riseInSx(140),
            }}
          >
            <Chip
              size="small"
              icon={<CheckCircleRoundedIcon />}
              label="Free to start"
              sx={{
                mb: 1.5,
                color: "common.white",
                bgcolor: "rgba(var(--surface-rgb), 0.12)",
                border: "1px solid rgba(255,255,255,0.22)",
                "& .MuiChip-icon": { color: "common.white" },
              }}
            />
            <Button
              component="a"
              href={signupUrl}
              size="large"
              fullWidth
              sx={{
                justifyContent: "space-between",
                bgcolor: "common.white",
                color: "primary.main",
                minHeight: 58,
                px: 2.5,
                "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.9)" },
              }}
              endIcon={<ArrowForwardRoundedIcon />}
            >
              {site.primaryCta.label}
            </Button>
            <Box
              sx={{
                mt: 1.25,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                px: 0.5,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Plans and fees
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.68)" }}
                >
                  Free plan available
                </Typography>
              </Box>
              <Button
                component={RouterLink}
                to="/pricing"
                size="small"
                sx={{
                  color: "common.white",
                  minHeight: 36,
                  px: 1,
                  "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
                }}
                endIcon={<ArrowForwardRoundedIcon />}
              >
                See pricing
              </Button>
            </Box>
            <Divider sx={{ my: 1.75, borderColor: "rgba(255,255,255,0.18)" }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr" },
                gap: 1,
              }}
            >
              {["No monthly cost to start", "Your money stays yours"].map(
                (line) => (
                  <Stack
                    key={line}
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    <CheckCircleRoundedIcon sx={{ fontSize: 17 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {line}
                    </Typography>
                  </Stack>
                ),
              )}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
