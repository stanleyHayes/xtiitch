import Box from "@mui/material/Box";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import RocketLaunchRounded from "@mui/icons-material/RocketLaunchRounded";
import { tokens } from "../../theme";
import type { AdminSession } from "../../lib/session";
import { AdminNavItem, Section } from "../shared/types";
import { AdminUserMenu } from "./AdminUserMenu";

// eslint-disable-next-line complexity, max-lines-per-function -- shell renders responsive navigation and all global actions in one stable toolbar
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
  launchEnabledCount,
  onOpenLaunchControls,
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
  launchEnabledCount: number;
  onOpenLaunchControls: () => void;
}) {
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
          <Tooltip
            title={`Launch controls · ${launchEnabledCount}/4 links live`}
          >
            <Button
              aria-label="Open launch controls"
              onClick={onOpenLaunchControls}
              variant={launchEnabledCount === 4 ? "outlined" : "contained"}
              color={launchEnabledCount === 4 ? "success" : "primary"}
              startIcon={<RocketLaunchRounded />}
              sx={{
                minWidth: { xs: 40, sm: "auto" },
                width: { xs: 40, sm: "auto" },
                height: { xs: 40, sm: 44 },
                px: { xs: 0, sm: 1.5 },
                "& .MuiButton-startIcon": { m: { xs: 0, sm: "0 8px 0 -4px" } },
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                Launch · {launchEnabledCount}/4
              </Box>
            </Button>
          </Tooltip>
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
          <AdminUserMenu
            admin={admin}
            darkChrome={darkChrome}
            onSelect={onSelect}
          />
        </Stack>
      </Stack>
    </Box>
  );
}
