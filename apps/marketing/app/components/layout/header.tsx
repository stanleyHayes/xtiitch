import { useState } from "react";
import { useLocation, useRouteLoaderData } from "react-router";
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
    | { marketplaceUrl?: string; signupUrl?: string }
    | undefined;
  const marketplaceUrl =
    rootData?.marketplaceUrl ?? "https://store.xtiitch.com";
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;
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
        py: { xs: 0.75, md: 1.25 },
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
            minHeight: { xs: 54, md: 62 },
            gap: 2,
            px: { xs: 1.5, md: 1.5 },
            py: { xs: 0.5, md: 0.75 },
            border: "1px solid",
            borderColor: {
              xs: "rgba(128,0,32,0.13)",
              md: "divider",
            },
            borderRadius: { xs: 2.25, md: 1 },
            bgcolor: "rgba(var(--surface-rgb), 0.88)",
            boxShadow: {
              xs: "0 16px 42px -32px rgba(21,17,26,0.62)",
              md: "0 18px 44px -34px rgba(21,17,26,0.52)",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              left: { xs: 18, md: 24 },
              right: { xs: 18, md: 24 },
              bottom: -1,
              height: "1px",
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, transparent, rgba(128,0,32,0.62), transparent)",
              opacity: { xs: 1, md: 0 },
            },
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
              component="a"
              href={signupUrl}
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ minWidth: 154 }}
            >
              {site.primaryCta.label}
            </Button>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              display: { xs: "flex", md: "none" },
              ml: "auto",
              alignItems: "center",
            }}
          >
            <ThemeModeToggle
              sx={{
                width: 40,
                height: 40,
                bgcolor: "rgba(var(--surface-rgb),0.72)",
              }}
            />
            <Button
              aria-label="Open menu"
              onClick={() => {
                setOpen(true);
              }}
              variant="contained"
              startIcon={<MenuIcon />}
              sx={{
                minWidth: 0,
                minHeight: 40,
                px: 1.5,
                color: "common.white",
                bgcolor: "primary.main",
                borderRadius: 999,
                fontSize: 13,
                boxShadow: "0 12px 28px -16px rgba(128,0,32,0.82)",
                transition: "transform 180ms ease, background-color 180ms ease",
                "& .MuiButton-startIcon": {
                  mr: 0.65,
                  "& .MuiSvgIcon-root": { fontSize: 20 },
                },
                "&:hover": {
                  bgcolor: "primary.dark",
                  transform: "translateY(-1px)",
                },
                "&:active": { transform: "translateY(0)" },
              }}
            >
              Menu
            </Button>
          </Stack>
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
            component="a"
            href={signupUrl}
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
