import { useEffect, useRef, useState, type ReactNode } from "react";
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
import CheckroomRoundedIcon from "@mui/icons-material/CheckroomRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
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
import { site } from "../content";

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

type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: ReactNode;
};

type NavGroup = { label: string; blurb: string; items: NavItem[] };

// Grouped navigation. Keeping the top bar to a couple of rich dropdowns instead
// of a long row of links — each entry carries an icon, a one-line description
// and a soft background decoration.
const navGroups: NavGroup[] = [
  {
    label: "Discover",
    blurb: "Browse real shops and designs on Xtiitch.",
    items: [
      {
        label: "Shops",
        href: "/shops",
        description: "Verified studios running their storefronts on Xtiitch.",
        icon: <StorefrontRoundedIcon />,
      },
      {
        label: "Designs",
        href: "/designs",
        description: "Browse pieces and order from the studio directly.",
        icon: <CheckroomRoundedIcon />,
      },
    ],
  },
  {
    label: "Platform",
    blurb: "Everything to run a fashion business in one place.",
    items: [
      {
        label: "Features",
        href: "/features",
        description: "Storefront, catalogue, orders, payments and tracking.",
        icon: <Inventory2RoundedIcon />,
      },
      {
        label: "How it works",
        href: "/how-it-works",
        description: "From store setup to taking payment, step by step.",
        icon: <ChecklistRoundedIcon />,
      },
      {
        label: "Pricing",
        href: "/pricing",
        description: "Free to start; a small share only on sales.",
        icon: <LocalOfferRoundedIcon />,
      },
      {
        label: "Growth",
        href: "/growth",
        description: "Promotions, referrals, affiliates and sponsored slots.",
        icon: <TrendingUpRoundedIcon />,
      },
    ],
  },
  {
    label: "Why Xtiitch",
    blurb: "Built for trust, and for the people who buy.",
    items: [
      {
        label: "For customers",
        href: "/for-customers",
        description: "Browse, order and follow “where is my cloth?”.",
        icon: <GroupsRoundedIcon />,
      },
      {
        label: "Security",
        href: "/security",
        description: "Tenant isolation, Paystack payments, no held funds.",
        icon: <SecurityRoundedIcon />,
      },
      {
        label: "FAQ",
        href: "/faq",
        description: "Answers on payments, deposits, refunds and safety.",
        icon: <HelpRoundedIcon />,
      },
    ],
  },
];

const NAV_ACCENTS = [
  "rgba(128,0,32,0.16)",
  "rgba(197,139,44,0.20)",
  "rgba(49,95,143,0.16)",
  "rgba(35,122,75,0.16)",
];

function MegaItem({
  item,
  index,
  active = false,
  onNavigate,
}: {
  item: NavItem;
  index: number;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Box
      component={RouterLink}
      to={item.href}
      onClick={onNavigate}
      sx={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        p: 1.5,
        borderRadius: 1.5,
        textDecoration: "none",
        color: active ? "primary.main" : "text.primary",
        border: "1px solid",
        borderColor: active ? "rgba(128,0,32,0.16)" : "transparent",
        bgcolor: active ? "rgba(128,0,32,0.06)" : "transparent",
        transition:
          "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
        "&::after": {
          content: '""',
          position: "absolute",
          top: -30,
          right: -26,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${NAV_ACCENTS[index % NAV_ACCENTS.length]}, transparent 68%)`,
          pointerEvents: "none",
          transition: "transform 260ms ease",
        },
        "&:hover": {
          transform: "translateY(-2px)",
          bgcolor: "rgba(128,0,32,0.04)",
          borderColor: "rgba(128,0,32,0.12)",
          "& .mega-ico": { transform: "rotate(-4deg) scale(1.06)" },
          "& .mega-go": { opacity: 1, transform: "translateX(0)" },
          "&::after": { transform: "scale(1.18)" },
        },
      }}
    >
      <Box
        className="mega-ico"
        aria-hidden
        sx={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          color: "primary.main",
          background:
            "linear-gradient(135deg, rgba(128,0,32,0.10), rgba(197,139,44,0.16))",
          border: "1px solid rgba(128,0,32,0.12)",
          transition: "transform 220ms ease",
          "& svg": { fontSize: 22 },
        }}
      >
        {item.icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>
            {item.label}
          </Typography>
          <ArrowForwardRoundedIcon
            className="mega-go"
            sx={{
              fontSize: 15,
              color: "primary.main",
              opacity: 0,
              transform: "translateX(-4px)",
              transition: "opacity 180ms ease, transform 180ms ease",
            }}
          />
        </Box>
        <Typography
          variant="body2"
          sx={{ mt: 0.25, color: "text.secondary", fontSize: 12.5, lineHeight: 1.45 }}
        >
          {item.description}
        </Typography>
      </Box>
    </Box>
  );
}

function MegaMenu({ active }: { active: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => setOpen(null), 140);
  };

  // Close whenever the route changes.
  useEffect(() => {
    setOpen(null);
  }, [active]);
  useEffect(() => () => cancelClose(), []);

  return (
    <>
      {navGroups.map((group) => {
        const isOpen = open === group.label;
        const hasActive = group.items.some((i) => i.href === active);
        return (
          <Box
            key={group.label}
            onMouseEnter={() => {
              cancelClose();
              setOpen(group.label);
            }}
            onMouseLeave={scheduleClose}
            sx={{ position: "relative" }}
          >
            <Box
              component="button"
              type="button"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : group.label)}
              sx={{
                appearance: "none",
                cursor: "pointer",
                font: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                minHeight: 40,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: isOpen || hasActive ? "primary.main" : "text.primary",
                bgcolor:
                  isOpen || hasActive ? "rgba(128,0,32,0.08)" : "transparent",
                border: "1px solid",
                borderColor:
                  isOpen || hasActive ? "rgba(128,0,32,0.14)" : "transparent",
                transition:
                  "color 180ms ease, background-color 180ms ease, border-color 180ms ease",
                "&:hover": {
                  color: "primary.main",
                  bgcolor: "rgba(128,0,32,0.06)",
                },
              }}
            >
              {group.label}
              <ExpandMoreRoundedIcon
                aria-hidden
                sx={{
                  fontSize: 18,
                  transition: "transform 200ms ease",
                  transform: isOpen ? "rotate(180deg)" : "none",
                }}
              />
            </Box>

            <Box
              role="menu"
              sx={{
                position: "absolute",
                top: "100%",
                left: 0,
                pt: 1.25,
                zIndex: (t) => t.zIndex.appBar + 2,
                opacity: isOpen ? 1 : 0,
                visibility: isOpen ? "visible" : "hidden",
                transform: isOpen ? "translateY(0)" : "translateY(-8px)",
                transition:
                  "opacity 190ms ease, transform 190ms ease, visibility 190ms",
                pointerEvents: isOpen ? "auto" : "none",
              }}
            >
              <Box
                sx={{
                  width: 392,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.98)",
                  backdropFilter: "saturate(180%) blur(14px)",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 30px 70px -38px rgba(21,17,26,0.6)",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    px: 1.5,
                    pt: 0.5,
                    pb: 1,
                    color: "text.secondary",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {group.blurb}
                </Typography>
                <Stack spacing={0.5}>
                  {group.items.map((item, i) => (
                    <MegaItem
                      key={item.href}
                      item={item}
                      index={i}
                      active={item.href === active}
                    />
                  ))}
                </Stack>
              </Box>
            </Box>
          </Box>
        );
      })}
    </>
  );
}

function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      {navGroups.map((group) => (
        <Box key={group.label} sx={{ mb: 1.5 }}>
          <Typography
            sx={{
              px: 0.5,
              mb: 0.75,
              fontWeight: 800,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "text.secondary",
            }}
          >
            {group.label}
          </Typography>
          <Stack spacing={0.5}>
            {group.items.map((item, i) => (
              <MegaItem
                key={item.href}
                item={item}
                index={i}
                onNavigate={onNavigate}
              />
            ))}
          </Stack>
        </Box>
      ))}
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
            <MegaMenu active={pathname} />
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
          <MobileNav onNavigate={close} />
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
                  "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
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
                    bgcolor: "rgba(255,255,255,0.08)",
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
                  bgcolor: "rgba(255,255,255,0.08)",
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
                bgcolor: "rgba(255,255,255,0.05)",
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
                      }}
                    >
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
