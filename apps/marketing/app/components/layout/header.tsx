import { useState } from "react";
import { Link as RouterLink, useLocation, useRouteLoaderData } from "react-router";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import Typography from "@mui/material/Typography";
import { site } from "../../content";
import { ThemeModeToggle } from "../../theme-mode";
import { useMarketingFlags } from "../../root";
import { Logo } from "./logo";
import { navGroups } from "./nav-data";
import { MegaMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";

export function Header() { // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const rootData = useRouteLoaderData("root") as
    | { marketplaceUrl?: string }
    | undefined;
  const marketplaceUrl =
    rootData?.marketplaceUrl ?? "https://store.xtiitch.com";
  // Pre-launch gating: the "Discover" group (and its sub-items) only show when
  // the discover flag is live; the "Browse the store" button only when
  // browse_store is live. Both default hidden.
  const flags = useMarketingFlags();
  const visibleGroups = flags.discover
    ? navGroups
    : navGroups.filter((group) => group.label !== "Discover");
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
        backgroundColor: "rgba(var(--surface-rgb), 0.78)",
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
            bgcolor: "rgba(var(--surface-rgb), 0.8)",
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
              bgcolor: "rgba(var(--surface-rgb),0.8)",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <MegaMenu active={pathname} groups={visibleGroups} />
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            <ThemeModeToggle />
            {flags.browse_store ? (
              <Button
                href={marketplaceUrl}
                target="_blank"
                rel="noopener"
                variant="outlined"
                startIcon={<StorefrontRoundedIcon />}
                sx={{ fontWeight: 800 }}
              >
                Browse the store
              </Button>
            ) : null}
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
          {/* The menu trigger is wrapped in the same bordered "box" treatment as
              the logo tile so the two read as a matched pair on mobile/tablet
              (the logo sits in a box; the hamburger now does too). */}
          <Box
            sx={{
              display: { xs: "inline-flex", md: "none" },
              ml: "auto",
              p: 0.5,
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb),0.8)",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <IconButton
              aria-label="Open menu"
              edge={false}
              onClick={() => {
                setOpen(true);
              }}
              sx={{
                width: 40,
                height: 40,
                color: "common.white",
                bgcolor: "primary.main",
                borderRadius: 1.25,
                boxShadow: "0 10px 24px -12px rgba(128,0,32,0.7)",
                transition: "transform 180ms ease, background-color 180ms ease",
                "&:hover": {
                  bgcolor: "primary.dark",
                  transform: "translateY(-1px)",
                },
                "&:active": { transform: "translateY(0)" },
              }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
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
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <ThemeModeToggle />
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
          </Stack>
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
          <MobileNav onNavigate={close} groups={visibleGroups} />
          {flags.browse_store ? (
            <Button
              href={marketplaceUrl}
              target="_blank"
              rel="noopener"
              onClick={close}
              variant="outlined"
              size="large"
              startIcon={<StorefrontRoundedIcon />}
              sx={{ mt: 1.25, fontWeight: 800 }}
            >
              Browse the store
            </Button>
          ) : null}
          <Button
            component={RouterLink}
            to={site.primaryCta.href}
            onClick={close}
            variant="contained"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            {site.primaryCta.label}
          </Button>
        </Stack>
      </Drawer>
    </AppBar>
  );
}
