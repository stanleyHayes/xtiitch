import { Form } from "react-router";
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import type { ReactNode } from "react";
import { tokens } from "../../theme";
import type { AdminSession } from "../../lib/session";
import type { Section } from "../shared/types";

const menuSections: {
  label: string;
  helper: string;
  icon: ReactNode;
  section: Section;
}[] = [
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
];

function initials(displayName: string): string {
  return displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminUserMenu({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  admin,
  darkChrome,
  onSelect,
}: {
  admin: AdminSession;
  darkChrome: boolean;
  onSelect: (section: Section) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);
  const selectAndClose = (section: Section) => {
    onSelect(section);
    close();
  };

  return (
    <>
      <Tooltip title="Profile and settings">
        <IconButton
          aria-label="Open profile menu"
          onClick={(event) => setAnchor(event.currentTarget)}
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
            {initials(admin.adminDisplayName)}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={close}
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
            {initials(admin.adminDisplayName)}
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

        <Box sx={{ py: 0.5 }}>
          {menuSections.map((entry) => (
            <MenuItem
              key={entry.label}
              onClick={() => selectAndClose(entry.section)}
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
    </>
  );
}
