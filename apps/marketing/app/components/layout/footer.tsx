import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { site } from "../../content";
import { Logo } from "./logo";
import { footerGroups, footerProof } from "./footer-data";

export function Footer() { // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  const year = 2026;
  return (
    <Box
      component="footer"
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "secondary.main",
        color: "common.white",
        borderTop: "1px solid rgba(197,139,44,0.4)",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(58% 80% at 6% -12%, rgba(128,0,32,0.6), transparent 60%),
            radial-gradient(46% 64% at 102% -6%, rgba(197,139,44,0.16), transparent 56%),
            radial-gradient(40% 60% at 52% 128%, rgba(128,0,32,0.5), transparent 62%)
          `,
        }}
      />
      <Container sx={{ position: "relative", py: { xs: 6, md: 9 } }}>
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 3,
            p: { xs: 3, md: 5 },
            mb: { xs: 6, md: 8 },
            background:
              "linear-gradient(135deg, rgba(128,0,32,0.96), rgba(94,0,24,0.96))",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 44px 90px -54px rgba(0,0,0,0.85)",
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: -130,
              right: -90,
              width: 380,
              height: 380,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.10)",
              background:
                "radial-gradient(circle, rgba(197,139,44,0.20), transparent 66%)",
            }}
          />
          <Box
            sx={{
              position: "relative",
              display: "grid",
              gap: { xs: 3, md: 4 },
              gridTemplateColumns: { xs: "1fr", md: "1.45fr auto" },
              alignItems: "center",
            }}
          >
            <Box>
              <Typography
                sx={{
                  color: "rgba(232,196,128,0.95)",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                Launching soon
              </Typography>
              <Typography
                variant="h3"
                component="p"
                sx={{
                  mt: 1.5,
                  color: "common.white",
                  fontSize: { xs: 26, md: 38 },
                  maxWidth: 640,
                }}
              >
                Start free, then grow into a plan when orders pick up.
              </Typography>
              <Typography
                sx={{ mt: 2, color: "rgba(255,255,255,0.76)", maxWidth: 580 }}
              >
                {site.promise}
              </Typography>
            </Box>
            <Stack spacing={1.5} sx={{ minWidth: { md: 248 } }}>
              <Button
                component={RouterLink}
                to={site.primaryCta.href}
                variant="contained"
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
                variant="outlined"
                size="large"
                sx={{
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.4)",
                  "&:hover": {
                    borderColor: "common.white",
                    bgcolor: "rgba(var(--surface-rgb), 0.08)",
                  },
                }}
              >
                {site.secondaryCta.label}
              </Button>
            </Stack>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ position: "relative", mt: { xs: 3, md: 4 }, flexWrap: "wrap" }}
          >
            {footerProof.map((item) => (
              <Box
                key={item.label}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  minHeight: 36,
                  px: 1.5,
                  borderRadius: 999,
                  color: "rgba(255,255,255,0.86)",
                  bgcolor: "rgba(var(--surface-rgb), 0.08)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  "& svg": { fontSize: 17, color: "rgba(232,196,128,0.9)" },
                }}
              >
                {item.icon}
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "1.05fr 1.95fr" },
          }}
        >
          <Box>
            <Logo tone="light" />
            <Typography
              sx={{
                mt: 2.5,
                color: "rgba(255,255,255,0.78)",
                maxWidth: 360,
                fontSize: 18,
                lineHeight: 1.5,
              }}
            >
              {site.oneLiner}
            </Typography>
            <Box
              sx={{
                mt: 3,
                display: "inline-flex",
                alignItems: "center",
                gap: 1.25,
                px: 1.75,
                py: 1.25,
                borderRadius: 2,
                bgcolor: "rgba(var(--surface-rgb), 0.05)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  bgcolor: "#c58b2c",
                  boxShadow: "0 0 0 4px rgba(197,139,44,0.22)",
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Xtiitch never holds your money
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: { xs: 4, md: 3 },
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
            }}
          >
            {footerGroups.map((group) => (
              <Box key={group.heading}>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1.75,
                    color: "common.white",
                    "& svg": { fontSize: 18 },
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 1,
                      display: "grid",
                      placeItems: "center",
                      color: "common.white",
                      background:
                        "linear-gradient(135deg, rgba(128,0,32,0.6), rgba(197,139,44,0.32))",
                      border: "1px solid rgba(255,255,255,0.16)",
                    }}
                  >
                    {group.icon}
                  </Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                      color: "rgba(255,255,255,0.96)",
                    }}
                  >
                    {group.heading}
                  </Typography>
                </Box>
                <Stack spacing={0.5}>
                  {group.links.map((link) => {
                    const linkSx = {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      width: "fit-content",
                      minHeight: 32,
                      color: "rgba(255,255,255,0.74)",
                      fontWeight: 600,
                      fontSize: 14,
                      "& svg": { fontSize: 16 },
                      "& .footer-link-icon": {
                        color: "rgba(255,255,255,0.6)",
                        transition:
                          "transform 180ms ease, color 180ms ease, background-color 180ms ease",
                      },
                      "&:hover": {
                        color: "common.white",
                        "& .footer-link-icon": {
                          transform: "translateX(2px)",
                          color: "#e8c480",
                          bgcolor: "rgba(197,139,44,0.18)",
                        },
                      },
                    } as const;
                    const iconBox = (
                      <Box
                        component="span"
                        className="footer-link-icon"
                        aria-hidden
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          display: "grid",
                          placeItems: "center",
                          bgcolor: "rgba(var(--surface-rgb), 0.06)",
                        }}
                      >
                        {link.icon}
                      </Box>
                    );
                    // The Privacy/Terms/Payment-policy labels stay visible but
                    // must not navigate to their unreviewed pages yet — render
                    // them as a clickable-looking but inert span (href="#" with
                    // the default suppressed).
                    if (link.nonNavigating) {
                      return (
                        <Link
                          key={link.href}
                          component="a"
                          href="#"
                          underline="none"
                          onClick={(event) => event.preventDefault()}
                          sx={{ ...linkSx, cursor: "pointer" }}
                        >
                          {iconBox}
                          {link.label}
                        </Link>
                      );
                    }
                    return (
                      <Link
                        key={link.href}
                        component={RouterLink}
                        to={link.href}
                        underline="none"
                        sx={linkSx}
                      >
                        {iconBox}
                        {link.label}
                      </Link>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider
          sx={{ my: { xs: 4, md: 5 }, borderColor: "rgba(255,255,255,0.12)" }}
        />

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 1.5,
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
          }}
        >
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>
            © {year} {site.company}. Built for Ghanaian fashion businesses.
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>
            Xtiitch never holds customer funds; payments settle through Paystack.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
