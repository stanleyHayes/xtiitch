import { Link as RouterLink, useRouteLoaderData } from "react-router";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import Instagram from "@mui/icons-material/Instagram";
import MusicNoteRounded from "@mui/icons-material/MusicNoteRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { site } from "../../content";
import { tokens } from "../../theme";
import { footerGroups, footerProof } from "./footer-data";
import { Logo } from "./logo";

const socialLinks = [
  {
    label: "Instagram",
    handle: "@xtiitch",
    href: "https://www.instagram.com/xtiitch?igsh=b2JyejFueXBreHpp&utm_source=qr",
    icon: <Instagram />,
  },
  {
    label: "TikTok",
    handle: "@xtiitch",
    href: "https://www.tiktok.com/@xtiitch?_r=1&_t=ZS-98FyVEdkVZV",
    icon: <MusicNoteRounded />,
  },
] as const;

const footerLinkSx = {
  width: "fit-content",
  color: "rgba(255,255,255,.68)",
  fontSize: 14,
  fontWeight: 650,
  textDecoration: "none",
  transition: "color 160ms ease, transform 160ms ease",
  "&:hover": { color: tokens.white, transform: "translateX(3px)" },
} as const;

// eslint-disable-next-line max-lines-per-function -- cohesive editorial footer composition
export function Footer() {
  const rootData = useRouteLoaderData("root") as
    | { signupUrl?: string }
    | undefined;
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;

  return (
    <Box
      component="footer"
      sx={{
        position: "relative",
        overflow: "hidden",
        color: tokens.white,
        bgcolor: tokens.ink,
        borderTop: `1px solid ${alpha(tokens.gold, 0.32)}`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${alpha(tokens.white, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.white, 0.035)} 1px, transparent 1px), radial-gradient(circle at 82% 4%, ${alpha(tokens.burgundy, 0.58)}, transparent 34%)`,
          backgroundSize: "42px 42px, 42px 42px, auto",
          maskImage: "linear-gradient(to bottom, black, rgba(0,0,0,.78))",
        }}
      />

      <Container
        maxWidth="xl"
        sx={{ position: "relative", py: { xs: 5, md: 7 } }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1.45fr) minmax(340px, .55fr)",
            },
            gap: { xs: 3, lg: 5 },
            alignItems: "stretch",
          }}
        >
          <Box
            sx={{
              p: { xs: 3, md: 4.5 },
              borderRadius: 3,
              background: `linear-gradient(135deg, ${tokens.burgundy}, #4f0014)`,
              border: `1px solid ${alpha(tokens.white, 0.14)}`,
              boxShadow: `0 32px 80px ${alpha(tokens.ink, 0.36)}`,
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: "#efd59d", fontWeight: 900, letterSpacing: ".16em" }}
            >
              Fashion, in good order
            </Typography>
            <Typography
              component="p"
              sx={{
                mt: 1,
                maxWidth: 760,
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: { xs: 30, md: 46 },
                fontWeight: 800,
                lineHeight: 1.04,
              }}
            >
              Put your studio where customers can find it.
            </Typography>
            <Typography
              sx={{
                mt: 1.75,
                maxWidth: 660,
                color: alpha(tokens.white, 0.74),
                lineHeight: 1.7,
              }}
            >
              Start with a real storefront, keep every order moving, and give
              customers a clearer way to buy from you.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ mt: 3, alignItems: { sm: "center" } }}
            >
              <Button
                component="a"
                href={signupUrl}
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRounded />}
                sx={{
                  bgcolor: tokens.white,
                  color: tokens.burgundy,
                  "&:hover": { bgcolor: "#fff7f3" },
                }}
              >
                Start for free
              </Button>
              <Button
                component={RouterLink}
                to="/how-it-works"
                variant="text"
                size="large"
                sx={{ color: tokens.white }}
              >
                See how it works
              </Button>
            </Stack>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              p: { xs: 2.5, md: 3 },
              borderRadius: 3,
              bgcolor: alpha(tokens.white, 0.055),
              border: `1px solid ${alpha(tokens.white, 0.12)}`,
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 850, fontSize: 18 }}>
                Follow the stitch
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, color: alpha(tokens.white, 0.62) }}
              >
                New studios, fresh pieces, and practical fashion-business ideas.
              </Typography>
            </Box>
            <Stack spacing={1.25} sx={{ mt: 2.5 }}>
              {socialLinks.map((social) => (
                <Box
                  key={social.label}
                  component="a"
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    minHeight: 62,
                    px: 2,
                    color: tokens.white,
                    textDecoration: "none",
                    borderRadius: 2,
                    bgcolor: alpha(tokens.white, 0.065),
                    border: `1px solid ${alpha(tokens.white, 0.12)}`,
                    transition:
                      "background-color 160ms ease, transform 160ms ease",
                    "&:hover": {
                      bgcolor: alpha(tokens.white, 0.11),
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.gold, 0.16),
                      color: "#efd59d",
                    }}
                  >
                    {social.icon}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 850, lineHeight: 1.2 }}>
                      {social.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: alpha(tokens.white, 0.58) }}
                    >
                      {social.handle}
                    </Typography>
                  </Box>
                  <ArrowOutwardRounded fontSize="small" />
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>

        <Divider
          sx={{ my: { xs: 4, md: 5 }, borderColor: alpha(tokens.white, 0.11) }}
        />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(260px, .9fr) minmax(0, 2.1fr)",
            },
            gap: { xs: 4, lg: 7 },
          }}
        >
          <Box>
            <Logo tone="light" />
            <Typography
              sx={{
                mt: 2,
                maxWidth: 380,
                color: alpha(tokens.white, 0.68),
                lineHeight: 1.65,
              }}
            >
              {site.oneLiner}
            </Typography>
            <Stack
              direction="row"
              useFlexGap
              sx={{ mt: 2.5, flexWrap: "wrap", gap: 0.75 }}
            >
              {footerProof.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.65,
                    px: 1.1,
                    py: 0.65,
                    borderRadius: 999,
                    color: alpha(tokens.white, 0.72),
                    bgcolor: alpha(tokens.white, 0.05),
                    border: `1px solid ${alpha(tokens.white, 0.1)}`,
                    "& svg": { fontSize: 15, color: "#efd59d" },
                  }}
                >
                  {item.icon}
                  <Typography variant="caption" sx={{ fontWeight: 750 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(4, minmax(0, 1fr))",
              },
              gap: { xs: 3, md: 4 },
            }}
          >
            {footerGroups.map((group) => (
              <Box key={group.heading}>
                <Typography
                  sx={{ mb: 1.25, color: tokens.white, fontWeight: 850 }}
                >
                  {group.heading}
                </Typography>
                <Stack spacing={0.65}>
                  {group.links.map((item) =>
                    item.href.startsWith("/") ? (
                      <Link
                        key={item.href}
                        component={RouterLink}
                        to={item.href}
                        sx={footerLinkSx}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <Link
                        key={item.href}
                        component="a"
                        href={item.href}
                        sx={footerLinkSx}
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider
          sx={{
            my: { xs: 3.5, md: 4.5 },
            borderColor: alpha(tokens.white, 0.11),
          }}
        />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          sx={{
            justifyContent: "space-between",
            color: alpha(tokens.white, 0.48),
          }}
        >
          <Typography variant="caption">
            © {new Date().getFullYear()} {site.company}. Built in Ghana for
            fashion businesses.
          </Typography>
          <Typography variant="caption">
            Payments settle securely through Paystack. Xtiitch never holds
            customer funds.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
