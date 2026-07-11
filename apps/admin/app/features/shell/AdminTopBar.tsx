import type { ReactNode } from "react";
import { Form } from "react-router";
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { tokens } from "../../theme";
import type { AdminSession } from "../../lib/session";
import { AdminNavItem, Section } from "../shared/types";



export function AdminTopBar({
  admin,
  currentSection,
  collapsed,
  darkChrome,
  notificationCount,
  onOpenMobileNav,
  onToggleCollapsed,
  onToggleDarkChrome,
  onSelect,
  onOpenHelp,
}: {
  admin: AdminSession;
  currentSection: AdminNavItem;
  collapsed: boolean;
  darkChrome: boolean;
  notificationCount: number;
  onOpenMobileNav: () => void;
  onToggleCollapsed: () => void;
  onToggleDarkChrome: (origin?: { x: number; y: number }) => void;
  onSelect: (section: Section) => void;
  onOpenHelp: () => void;
}) {
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const profileOpen = Boolean(profileAnchor);

  const closeProfileMenu = () => setProfileAnchor(null);
  const selectAndClose = (nextSection: Section) => {
    onSelect(nextSection);
    closeProfileMenu();
  };

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 2, md: 4 },
        py: { xs: 1, sm: 1.25 },
        borderBottom: "1px solid",
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
        position: "sticky",
        top: 0,
        zIndex: 3,
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
                display: { xs: "inline-flex", lg: "none" },
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
                display: { xs: "none", lg: "inline-flex" },
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
              admin.xtiitch.com
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              <Typography
                variant="h5"
                component="h1"
                sx={{
                  lineHeight: 1.05,
                  fontSize: { xs: "1.3rem", sm: "1.55rem" },
                }}
                noWrap
              >
                {currentSection.label}
              </Typography>
              <Tooltip title={`Guide: ${currentSection.label}`}>
                <IconButton
                  size="small"
                  aria-label="Open section guide"
                  onClick={onOpenHelp}
                  sx={{
                    color: "inherit",
                    flexShrink: 0,
                    border: "1px solid",
                    borderColor: darkChrome
                      ? alpha(tokens.white, 0.16)
                      : alpha(tokens.ink, 0.1),
                  }}
                >
                  <HelpOutlineRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 0.75 }}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <Tooltip title="Notifications">
            <IconButton
              aria-label="Open notifications"
              onClick={() => onSelect("notifications")}
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
                <NotificationsActiveRounded />
              </Badge>
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
                {admin.adminDisplayName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
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
                {admin.adminDisplayName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }} noWrap>
                  {admin.adminDisplayName}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                  noWrap
                >
                  {admin.adminEmail}
                </Typography>
                <Chip
                  size="small"
                  label={`${admin.adminRole} access`}
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

            {/* Sections */}
            <Box sx={{ py: 0.5 }}>
              {(
                [
                  {
                    label: "Profile settings",
                    helper: "Your account & sign-in",
                    icon: <AccountCircleRounded fontSize="small" />,
                    section: "settings",
                  },
                  {
                    label: "Platform settings",
                    helper: "Policies & controls",
                    icon: <SettingsRounded fontSize="small" />,
                    section: "settings",
                  },
                  {
                    label: "Notification routing",
                    helper: "Where alerts are sent",
                    icon: <NotificationsActiveRounded fontSize="small" />,
                    section: "notifications",
                  },
                  {
                    label: "Launch readiness",
                    helper: "Go-live checklist",
                    icon: <AssignmentTurnedInRounded fontSize="small" />,
                    section: "readiness",
                  },
                  {
                    label: "Audit log",
                    helper: "Console activity trail",
                    icon: <HistoryRounded fontSize="small" />,
                    section: "audit",
                  },
                ] as {
                  label: string;
                  helper: string;
                  icon: ReactNode;
                  section: Section;
                }[]
              ).map((entry) => (
                <MenuItem
                  key={entry.label}
                  onClick={() => selectAndClose(entry.section)}
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
                    Sign out
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
