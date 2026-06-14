import { useState } from "react";
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
import { navLinks, site } from "../content";

export function Logo({ onClick }: { onClick?: () => void }) {
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
        color: "text.primary",
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          borderRadius: 1,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 20,
          lineHeight: 1,
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
}: {
  active: string;
  onNavigate?: () => void;
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
            sx={{
              fontWeight: 600,
              color: isActive ? "primary.main" : "text.primary",
              py: 1,
              "&:hover": { color: "primary.main" },
            }}
          >
            {item.label}
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
        backdropFilter: "saturate(180%) blur(8px)",
        backgroundColor: "rgba(250, 246, 242, 0.85)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Container>
        <Toolbar disableGutters sx={{ minHeight: 68, gap: 2 }}>
          <Logo />
          <Box sx={{ flexGrow: 1 }} />
          <Stack
            direction="row"
            spacing={3}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            <NavItems active={pathname} />
            <Button
              component={RouterLink}
              to={site.primaryCta.href}
              variant="contained"
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
            sx={{ display: { xs: "inline-flex", md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>

      <Drawer
        anchor="right"
        open={open}
        onClose={close}
        slotProps={{ paper: { sx: { width: 280, p: 2 } } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Logo onClick={close} />
          <IconButton aria-label="Close menu" onClick={close}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.5}>
          <NavItems active={pathname} onNavigate={close} />
          <Button
            component={RouterLink}
            to={site.primaryCta.href}
            onClick={close}
            variant="contained"
            size="large"
            sx={{ mt: 1 }}
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
  links: { label: string; href: string }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { label: "Security", href: "/security" },
      { label: "For customers", href: "/for-customers" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Get started",
    links: [{ label: "Join the waitlist", href: "/contact" }],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  const year = 2026;
  return (
    <Box
      component="footer"
      sx={{ bgcolor: "secondary.main", color: "common.white", mt: 8 }}
    >
      <Container sx={{ py: { xs: 5, md: 7 } }}>
        <Box
          sx={{
            display: "grid",
            gap: 4,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1.4fr repeat(2, 1fr)",
              md: "1.4fr repeat(4, 1fr)",
            },
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 22 }}>
              Xtiitch
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 1.5, color: "rgba(255,255,255,0.72)", maxWidth: 320 }}
            >
              The operating system for fashion. A product of {site.company}.
            </Typography>
          </Box>
          {footerGroups.map((group) => (
            <Box key={group.heading}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                {group.heading}
              </Typography>
              <Stack spacing={1}>
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    component={RouterLink}
                    to={link.href}
                    underline="hover"
                    sx={{
                      color: "rgba(255,255,255,0.72)",
                      "&:hover": { color: "common.white" },
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
        <Divider sx={{ my: 4, borderColor: "rgba(255,255,255,0.16)" }} />
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>
          © {year} {site.company}. Built for Ghanaian fashion businesses.
        </Typography>
      </Container>
    </Box>
  );
}
