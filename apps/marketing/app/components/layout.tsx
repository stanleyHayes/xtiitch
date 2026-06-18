import { useState, type ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PrivacyTipRoundedIcon from "@mui/icons-material/PrivacyTipRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { navLinks, site } from "../content";

export function Logo({
  onClick,
  tone = "dark",
}: {
  onClick?: () => void;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";
  return (
    <Box
      component={RouterLink}
      to="/"
      onClick={onClick}
      aria-label={`${site.name} home`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        textDecoration: "none",
        color: isLight ? "common.white" : "text.primary",
        transition: "transform 180ms ease, color 180ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          borderRadius: 1,
          bgcolor: isLight ? "common.white" : "primary.main",
          color: isLight ? "primary.main" : "primary.contrastText",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 20,
          lineHeight: 1,
          transition: "transform 220ms ease, box-shadow 220ms ease",
          ".MuiBox-root:hover > &": {
            transform: "rotate(-3deg) scale(1.04)",
            boxShadow: isLight
              ? "0 16px 34px -24px rgba(255,255,255,0.72)"
              : "0 16px 34px -24px rgba(128,0,32,0.82)",
          },
        }}
      >
        X
      </Box>
      <Typography
        component="span"
        sx={{ fontWeight: 800, fontSize: 22, letterSpacing: 0 }}
      >
        Xtiitch
      </Typography>
    </Box>
  );
}

function NavItems({
  active,
  onNavigate,
  mobile = false,
}: {
  active: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <>
      {navLinks.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            component={RouterLink}
            to={item.href}
            onClick={onNavigate}
            underline="none"
            aria-current={isActive ? "page" : undefined}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: mobile ? "space-between" : "center",
              minHeight: mobile ? 48 : 40,
              px: mobile ? 1.5 : 1.25,
              py: mobile ? 1.25 : 1,
              borderRadius: 1,
              fontWeight: 700,
              color: isActive ? "primary.main" : "text.primary",
              bgcolor: isActive ? "rgba(128,0,32,0.08)" : "transparent",
              border: "1px solid",
              borderColor: isActive ? "rgba(128,0,32,0.14)" : "transparent",
              whiteSpace: "nowrap",
              transition:
                "transform 180ms ease, color 180ms ease, background-color 180ms ease, border-color 180ms ease",
              "&:hover": {
                transform: "translateY(-1px)",
                color: "primary.main",
                bgcolor: "rgba(128,0,32,0.06)",
                borderColor: "rgba(128,0,32,0.12)",
              },
            }}
          >
            {item.label}
            {mobile ? (
              <ArrowForwardRoundedIcon fontSize="small" aria-hidden />
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = () => {
    setOpen(false);
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={{
        top: 0,
        py: { xs: 1, md: 1.25 },
        backdropFilter: "saturate(180%) blur(14px)",
        backgroundColor: "rgba(250, 246, 242, 0.78)",
        borderBottom: "1px solid rgba(233,222,214,0.72)",
        animation: "xtiitch-rise-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
        },
      }}
    >
      <Container>
        <Toolbar
          disableGutters
          sx={{
            minHeight: { xs: 58, md: 62 },
            gap: 2,
            px: { xs: 1.25, md: 1.5 },
            py: 0.75,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "rgba(255,255,255,0.8)",
            boxShadow: "0 18px 44px -34px rgba(21,17,26,0.52)",
          }}
        >
          <Logo />
          <Box
            component="nav"
            aria-label="Main navigation"
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 0.25,
              ml: "auto",
              mr: 1,
              p: 0.5,
              borderRadius: 1,
              bgcolor: "rgba(250,246,242,0.8)",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <NavItems active={pathname} />
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            <Button
              component={RouterLink}
              to={site.primaryCta.href}
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ minWidth: 154 }}
            >
              {site.primaryCta.label}
            </Button>
          </Stack>
          <IconButton
            aria-label="Open menu"
            edge="end"
            onClick={() => {
              setOpen(true);
            }}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              ml: "auto",
              color: "text.primary",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.default",
            }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>

      <Drawer
        anchor="right"
        open={open}
        onClose={close}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "min(100vw, 360px)", sm: 380 },
              p: 2.5,
              bgcolor: "background.default",
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Logo onClick={close} />
          <IconButton
            aria-label="Close menu"
            onClick={close}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.paper",
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 1,
            bgcolor: "secondary.main",
            color: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 800 }}>
            A real shop for fashion businesses.
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.75, color: "rgba(255,255,255,0.72)" }}
          >
            Storefront, payments, orders and customer tracking in one place.
          </Typography>
        </Box>
        <Divider sx={{ my: 2.25 }} />
        <Stack component="nav" aria-label="Mobile navigation" spacing={0.75}>
          <NavItems active={pathname} onNavigate={close} mobile />
          <Button
            component={RouterLink}
            to={site.primaryCta.href}
            onClick={close}
            variant="contained"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ mt: 1.25 }}
          >
            {site.primaryCta.label}
          </Button>
        </Stack>
      </Drawer>
    </AppBar>
  );
}

const footerGroups: {
  heading: string;
  icon: ReactNode;
  links: { label: string; href: string; icon: ReactNode }[];
}[] = [
  {
    heading: "Product",
    icon: <StorefrontRoundedIcon />,
    links: [
      { label: "Features", href: "/features", icon: <Inventory2RoundedIcon /> },
      { label: "Growth", href: "/growth", icon: <TrendingUpRoundedIcon /> },
      {
        label: "How it works",
        href: "/how-it-works",
        icon: <ChecklistRoundedIcon />,
      },
      { label: "Pricing", href: "/pricing", icon: <LocalOfferRoundedIcon /> },
    ],
  },
  {
    heading: "For people",
    icon: <GroupsRoundedIcon />,
    links: [
      {
        label: "For customers",
        href: "/for-customers",
        icon: <GroupsRoundedIcon />,
      },
      { label: "FAQ", href: "/faq", icon: <HelpRoundedIcon /> },
    ],
  },
  {
    heading: "Trust",
    icon: <SecurityRoundedIcon />,
    links: [
      { label: "Security", href: "/security", icon: <SecurityRoundedIcon /> },
      {
        label: "Join the waitlist",
        href: "/contact",
        icon: <MailRoundedIcon />,
      },
    ],
  },
  {
    heading: "Legal",
    icon: <ArticleRoundedIcon />,
    links: [
      { label: "Privacy", href: "/privacy", icon: <PrivacyTipRoundedIcon /> },
      { label: "Terms", href: "/terms", icon: <ArticleRoundedIcon /> },
      {
        label: "Payment policy",
        href: "/payment-policy",
        icon: <PaymentsRoundedIcon />,
      },
    ],
  },
];

const footerProof: { label: string; icon: ReactNode }[] = [
  { label: "Branded storefront", icon: <StorefrontRoundedIcon /> },
  { label: "Growth programmes", icon: <CampaignRoundedIcon /> },
  { label: "Paystack payments", icon: <PaymentsRoundedIcon /> },
  { label: "Order tracking", icon: <TimelineRoundedIcon /> },
];

export function Footer() {
  const year = 2026;
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: "secondary.main",
        color: "common.white",
        mt: 0,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Container sx={{ py: { xs: 5, md: 8 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 4 },
            gridTemplateColumns: { xs: "1fr", md: "1.15fr 0.85fr" },
            alignItems: "stretch",
            pb: { xs: 4, md: 6 },
          }}
        >
          <Box>
            <Logo tone="light" />
            <Typography
              variant="h3"
              component="p"
              sx={{
                mt: 3,
                maxWidth: 620,
                color: "common.white",
                fontSize: { xs: 24, md: 30 },
              }}
            >
              Give customers a real shop and give your studio one place to run
              the work.
            </Typography>
            <Typography
              sx={{
                mt: 2,
                maxWidth: 560,
                color: "rgba(255,255,255,0.72)",
              }}
            >
              {site.promise}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ mt: 3, flexWrap: "wrap" }}
            >
              {footerProof.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    minHeight: 38,
                    px: 1.5,
                    borderRadius: 1,
                    color: "rgba(255,255,255,0.82)",
                    bgcolor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    "& svg": { fontSize: 18, color: "rgba(255,255,255,0.74)" },
                    transition:
                      "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      bgcolor: "rgba(255,255,255,0.1)",
                      borderColor: "rgba(255,255,255,0.2)",
                    },
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
              alignContent: "space-between",
              gap: 3,
              p: { xs: 2.5, md: 3 },
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              animation:
                "xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms backwards",
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }}
          >
            <Box>
              <Typography
                variant="body2"
                sx={{
                  color: "rgba(255,255,255,0.68)",
                  textTransform: "uppercase",
                  fontWeight: 800,
                }}
              >
                Launching soon
              </Typography>
              <Typography variant="h4" component="p" sx={{ mt: 1 }}>
                Start free, then grow into a plan when orders pick up.
              </Typography>
              <Stack spacing={1} sx={{ mt: 2.5 }}>
                {["Free plan available", "No platform-held wallet"].map(
                  (line) => (
                    <Box
                      key={line}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: "rgba(255,255,255,0.74)",
                      }}
                    >
                      <Box
                        aria-hidden
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "primary.main",
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {line}
                      </Typography>
                    </Box>
                  ),
                )}
              </Stack>
            </Box>
            <Button
              component={RouterLink}
              to={site.primaryCta.href}
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                justifySelf: "start",
                bgcolor: "common.white",
                color: "primary.main",
                "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
              }}
            >
              {site.primaryCta.label}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.14)" }} />

        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 4 },
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
            py: { xs: 4, md: 5 },
          }}
        >
          {footerGroups.map((group) => (
            <Box key={group.heading}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 1.5,
                  color: "common.white",
                  "& svg": {
                    fontSize: 18,
                  },
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
                    bgcolor: "rgba(128,0,32,0.46)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 16px 34px -28px rgba(128,0,32,0.9)",
                  }}
                >
                  {group.icon}
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.96)",
                  }}
                >
                  {group.heading}
                </Typography>
              </Box>
              <Stack spacing={1}>
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    component={RouterLink}
                    to={link.href}
                    underline="none"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      width: "fit-content",
                      minHeight: 34,
                      pr: 1,
                      color: "rgba(255,255,255,0.72)",
                      fontWeight: 600,
                      "& svg": {
                        fontSize: 17,
                      },
                      "& .footer-link-icon": {
                        color: "rgba(255,255,255,0.62)",
                        transition:
                          "transform 180ms ease, color 180ms ease, background-color 180ms ease",
                      },
                      "&:hover": {
                        color: "common.white",
                        "& .footer-link-icon": {
                          transform: "translateX(2px)",
                          color: "common.white",
                          bgcolor: "rgba(255,255,255,0.12)",
                        },
                      },
                    }}
                  >
                    <Box
                      component="span"
                      className="footer-link-icon"
                      aria-hidden
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: 1,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      {link.icon}
                    </Box>
                    {link.label}
                  </Link>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.14)" }} />

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 1.5,
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            pt: 3,
          }}
        >
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
            © {year} {site.company}. Built for Ghanaian fashion businesses.
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
            Xtiitch never holds customer funds; payments settle through
            Paystack.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
