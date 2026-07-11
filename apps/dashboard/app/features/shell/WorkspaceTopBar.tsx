import { Form } from "react-router";
import { Link as RouterLink } from "react-router";
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../theme";
import { Profile, CurrentUser, DashboardPageMeta } from "../shared/types";
import { roleLabel } from "../shared/utils";

export function WorkspaceTopBar({
  profile,
  currentUser,
  meta,
  verified,
  collapsed,
  darkChrome,
  notificationCount,
  storefrontURL,
  onOpenMobileNav,
  onToggleCollapsed,
  onToggleDarkChrome,
  onOpenHelp,
  onStartTour,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  meta: DashboardPageMeta;
  verified: boolean;
  collapsed: boolean;
  darkChrome: boolean;
  notificationCount: number;
  storefrontURL: string;
  onOpenMobileNav: () => void;
  onToggleCollapsed: () => void;
  onToggleDarkChrome: (origin?: { x: number; y: number }) => void;
  onOpenHelp: () => void;
  onStartTour: () => void;
}) {
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const profileOpen = Boolean(profileAnchor);
  const closeProfileMenu = () => setProfileAnchor(null);
  const avatarLabel = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Box
      sx={{
        px: { xs: 1.75, sm: 2.5, md: 4 },
        py: { xs: 1, sm: 1.25 },
        // A floating pill rather than a flush edge-to-edge bar: rounded all
        // round, lifted off the window edges, full border (not just a bottom
        // rule). Padding is kept.
        mx: { xs: 1, sm: 1.5, md: 2 },
        mt: { xs: 1, sm: 1.5 },
        borderRadius: 999,
        border: "1px solid",
        borderColor: darkChrome
          ? alpha(tokens.white, 0.12)
          : alpha(tokens.ink, 0.09),
        bgcolor: darkChrome
          ? alpha(tokens.charcoal, 0.94)
          : alpha(tokens.white, 0.86),
        color: darkChrome ? tokens.white : tokens.ink,
        backgroundImage: darkChrome
          ? `linear-gradient(90deg, ${alpha(tokens.burgundy, 0.24)}, ${alpha(tokens.charcoal, 0.94)})`
          : `linear-gradient(90deg, rgba(var(--surface-rgb), 0.96), rgba(var(--surface-rgb), 0.74))`,
        boxShadow: darkChrome
          ? `0 18px 40px ${alpha(tokens.ink, 0.5)}`
          : `0 18px 40px ${alpha(tokens.ink, 0.1)}`,
        position: "sticky",
        top: { xs: 8, sm: 12 },
        zIndex: 16,
        backdropFilter: "blur(14px)",
        maxWidth: "100%",
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: 0.75, sm: 1.25 }}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: { xs: 52, sm: 58 },
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={{ xs: 0.75, sm: 1 }}
          sx={{ alignItems: "center", minWidth: 0, flex: "1 1 auto" }}
        >
          <Tooltip title="Open navigation">
            <IconButton
              aria-label="Open navigation"
              onClick={onOpenMobileNav}
              sx={{
                display: { xs: "inline-flex", md: "none" },
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                color: "inherit",
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              <MenuRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <IconButton
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapsed}
              sx={{
                display: { xs: "none", md: "inline-flex" },
                color: "inherit",
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              {collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}
            </IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
            <Typography
              variant="overline"
              sx={{
                color: darkChrome ? alpha(tokens.white, 0.68) : "primary.main",
                fontWeight: 900,
                display: { xs: "none", sm: "block" },
              }}
            >
              {profile.handle}.xtiitch.com
            </Typography>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                lineHeight: 1.05,
                fontSize: { xs: "1.3rem", sm: "1.55rem" },
              }}
              noWrap
            >
              {meta.title}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 0.75 }}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <Tooltip title="Messages">
            <IconButton
              component={RouterLink}
              to="/dashboard/messages"
              aria-label="Open messages"
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              <Badge badgeContent={notificationCount} color="error" max={99}>
                <NotificationsRounded />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Page guide">
            <IconButton
              aria-label="Open page guide"
              data-tour="help"
              onClick={onOpenHelp}
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              <HelpOutlineRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title={darkChrome ? "Use light theme" : "Use dark theme"}>
            <IconButton
              aria-label="Toggle theme"
              onClick={(event) =>
                onToggleDarkChrome({ x: event.clientX, y: event.clientY })
              }
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              {darkChrome ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Profile and settings">
            <IconButton
              aria-label="Open profile menu"
              data-tour="account"
              onClick={(event) => setProfileAnchor(event.currentTarget)}
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
                p: 0.45,
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: darkChrome
                    ? alpha(tokens.white, 0.14)
                    : alpha(tokens.burgundy, 0.12),
                  color: darkChrome ? tokens.white : tokens.burgundy,
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                {avatarLabel || "X"}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={profileAnchor}
            open={profileOpen}
            onClose={closeProfileMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{
              list: { sx: { p: 0 } },
              paper: {
                sx: {
                  mt: 1.25,
                  minWidth: { xs: "calc(100vw - 32px)", sm: 304 },
                  maxWidth: "calc(100vw - 32px)",
                  borderRadius: 3,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  backgroundImage: "none",
                  boxShadow: (theme) =>
                    `0 28px 72px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.62 : 0.22)}`,
                },
              },
            }}
          >
            {/* Identity band */}
            <Box
              sx={{
                px: 2,
                py: 1.85,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                background: (theme) =>
                  `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.3 : 0.12)}, ${alpha(theme.palette.primary.main, 0)} 78%)`,
              }}
            >
              <Avatar
                sx={{
                  width: 46,
                  height: 46,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  fontWeight: 900,
                  fontSize: 16,
                  boxShadow: (theme) =>
                    `0 8px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                }}
              >
                {avatarLabel}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }} noWrap>
                  {profile.name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                  noWrap
                >
                  {profile.handle}.xtiitch.com
                </Typography>
                <Chip
                  size="small"
                  label={`${roleLabel(currentUser.role)}${verified ? "" : " · unverified"}`}
                  sx={{
                    mt: 0.5,
                    height: 20,
                    textTransform: "capitalize",
                    fontWeight: 800,
                    fontSize: 11,
                    color: "primary.main",
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
              </Box>
            </Box>

            {/* Items */}
            <Box sx={{ py: 0.5 }}>
              {[
                {
                  label: "Store settings",
                  helper: "Brand, policies & controls",
                  icon: <SettingsRounded fontSize="small" />,
                  to: "/dashboard/settings",
                },
                {
                  label: "Team access",
                  helper: "Staff logins & roles",
                  icon: <PeopleAltRounded fontSize="small" />,
                  to: "/dashboard/team",
                },
                {
                  label: "Messages",
                  helper: "Customer notifications",
                  icon: <NotificationsRounded fontSize="small" />,
                  to: "/dashboard/messages",
                },
              ].map((entry) => (
                <MenuItem
                  key={entry.label}
                  component={RouterLink}
                  to={entry.to}
                  onClick={closeProfileMenu}
                  sx={{
                    px: 2,
                    py: 1.1,
                    gap: 1.25,
                    "&:hover": {
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      borderRadius: 1.25,
                      display: "grid",
                      placeItems: "center",
                      color: "primary.main",
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.1),
                    }}
                  >
                    {entry.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}
                      noWrap
                    >
                      {entry.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                      noWrap
                    >
                      {entry.helper}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
              <MenuItem
                component={MuiLink}
                href={storefrontURL}
                target="_blank"
                rel="noreferrer"
                onClick={closeProfileMenu}
                sx={{
                  px: 2,
                  py: 1.1,
                  gap: 1.25,
                  textDecoration: "none",
                  "&:hover": {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 1.25,
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  <VisibilityRounded fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}
                    noWrap
                  >
                    View storefront
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                    noWrap
                  >
                    Open your public store
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem
                component={RouterLink}
                to="/security"
                onClick={closeProfileMenu}
                sx={{
                  px: 2,
                  py: 1.1,
                  gap: 1.25,
                  textDecoration: "none",
                  "&:hover": {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 1.25,
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  <LockRounded fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}
                    noWrap
                  >
                    Security
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                    noWrap
                  >
                    Two-step verification
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  closeProfileMenu();
                  onStartTour();
                }}
                sx={{
                  px: 2,
                  py: 1.1,
                  gap: 1.25,
                  "&:hover": {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 1.25,
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  <HelpOutlineRounded fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}
                    noWrap
                  >
                    Show me around
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                    noWrap
                  >
                    Replay the product tour
                  </Typography>
                </Box>
              </MenuItem>
            </Box>

            <Divider />

            {/* Sign out */}
            <Box sx={{ py: 0.5 }}>
              <Form method="post">
                <input type="hidden" name="intent" value="logout" />
                <MenuItem
                  component="button"
                  type="submit"
                  sx={{
                    width: "100%",
                    px: 2,
                    py: 1.1,
                    gap: 1.25,
                    color: "error.main",
                    "&:hover": {
                      bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                    },
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      borderRadius: 1.25,
                      display: "grid",
                      placeItems: "center",
                      color: "error.main",
                      bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
                    }}
                  >
                    <LogoutRounded fontSize="small" />
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                    Log out
                  </Typography>
                </MenuItem>
              </Form>
            </Box>
          </Menu>
        </Stack>
      </Stack>
    </Box>
  );
}