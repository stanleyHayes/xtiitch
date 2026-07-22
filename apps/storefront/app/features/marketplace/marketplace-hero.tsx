import { Form, Link as RouterLink } from "react-router";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";

// eslint-disable-next-line max-lines-per-function -- the selected hero is one cohesive responsive composition
export function MarketplaceHero() {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        minHeight: { xs: 560, md: 370 },
        color: tokens.white,
        backgroundImage: "url(/images/storefront-atelier-hero.webp)",
        backgroundSize: "cover",
        backgroundPosition: { xs: "64% center", md: "center 44%" },
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          bgcolor: { xs: "rgba(13, 8, 11, 0.72)", md: "rgba(13, 8, 11, 0.58)" },
        },
      }}
    >
      <Container
        maxWidth="xl"
        sx={{ position: "relative", py: { xs: 5, md: 5.5 } }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, .92fr) minmax(420px, .78fr)",
            },
            gap: { xs: 4, md: 6 },
            alignItems: "center",
          }}
        >
          <Box sx={{ maxWidth: 600 }}>
            <Typography
              variant="overline"
              sx={{
                color: "#f1c76e",
                fontWeight: 900,
                letterSpacing: "0.14em",
              }}
            >
              Ghana&apos;s fashion, in every detail
            </Typography>
            <Typography
              variant="h1"
              sx={{
                mt: 0.75,
                fontSize: { xs: "2.55rem", sm: "3.2rem", md: "3.6rem" },
                lineHeight: 1.04,
                color: tokens.white,
                textWrap: "balance",
              }}
            >
              Find the studio that brings your vision to life.
            </Typography>
            <Typography
              sx={{
                mt: 1.6,
                maxWidth: 510,
                color: alpha(tokens.white, 0.84),
                fontSize: { xs: 16, md: 17 },
              }}
            >
              Browse Ghana&apos;s fashion studios and their designs, or describe
              what you want and let AI help you find it.
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 2.25, flexWrap: "wrap" }}
            >
              <Button
                component={RouterLink}
                to="/track"
                startIcon={<LocalShippingRounded />}
                sx={{ color: tokens.white, px: 0.5 }}
              >
                Track an order
              </Button>
              <Button
                href="https://xtiitch.com"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: alpha(tokens.white, 0.76), px: 0.5 }}
              >
                Learn about Xtiitch
              </Button>
            </Stack>
          </Box>

          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 2,
              bgcolor: "rgba(25, 12, 18, 0.88)",
              border: "1px solid rgba(255,255,255,.28)",
              boxShadow: "0 22px 58px rgba(0,0,0,.26)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <AutoAwesomeRounded sx={{ color: "#f1c76e" }} />
              <Typography
                variant="overline"
                sx={{ fontWeight: 900, letterSpacing: "0.13em" }}
              >
                AI stylist
              </Typography>
            </Stack>
            <Typography
              sx={{ mt: 0.5, mb: 1.35, color: alpha(tokens.white, 0.88) }}
            >
              Describe what you&apos;re looking for
            </Typography>
            <Form method="get" action="/discover">
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  name="q"
                  placeholder="e.g. kente dress for a wedding under 800"
                  aria-label="Describe the fashion piece you want"
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: tokens.white,
                      color: tokens.ink,
                    },
                    "& .MuiOutlinedInput-input::placeholder": {
                      color: alpha(tokens.ink, 0.56),
                      opacity: 1,
                    },
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <AutoAwesomeRounded
                            fontSize="small"
                            sx={{ color: tokens.burgundy }}
                          />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  endIcon={<ArrowForwardRounded />}
                  sx={{ px: 2.5, flexShrink: 0 }}
                >
                  AI search
                </Button>
              </Stack>
            </Form>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
