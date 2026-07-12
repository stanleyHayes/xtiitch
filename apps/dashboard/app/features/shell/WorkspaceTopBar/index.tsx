import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import { tokens } from "../../../theme";
import type { Profile, CurrentUser, DashboardPageMeta } from "../../shared/types";
import { NotificationsBell } from "./NotificationsBell";
import { Search } from "./Search";
import { UserMenu } from "./UserMenu";

export function WorkspaceTopBar({
  profile,
  currentUser,
  meta,
  verified,
  collapsed,
  darkChrome,
  notificationCount,
  storefrontURL,
  pendingActivation,
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
  pendingActivation: boolean;
  onOpenMobileNav: () => void;
  onToggleCollapsed: () => void;
  onToggleDarkChrome: (origin?: { x: number; y: number }) => void;
  onOpenHelp: () => void;
  onStartTour: () => void;
}) {
  return (
    <Box
      sx={{
        px: { xs: 1.75, sm: 2.5, md: 4 },
        py: { xs: 1, sm: 1.25 },
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
        <Search
          profile={profile}
          meta={meta}
          collapsed={collapsed}
          darkChrome={darkChrome}
          onOpenMobileNav={onOpenMobileNav}
          onToggleCollapsed={onToggleCollapsed}
        />

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 0.75 }}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <NotificationsBell
            notificationCount={notificationCount}
            darkChrome={darkChrome}
          />
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
          <UserMenu
            profile={profile}
            currentUser={currentUser}
            verified={verified}
            storefrontURL={storefrontURL}
            pendingActivation={pendingActivation}
            onStartTour={onStartTour}
          />
        </Stack>
      </Stack>
    </Box>
  );
}
