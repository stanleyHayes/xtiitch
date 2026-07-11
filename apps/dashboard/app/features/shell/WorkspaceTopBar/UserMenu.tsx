import { Form } from "react-router";
import { Link as RouterLink } from "react-router";
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../../theme";
import type { Profile, CurrentUser } from "../../shared/types";
import { roleLabel } from "../../shared/utils";

export function UserMenu({
  profile,
  currentUser,
  verified,
  storefrontURL,
  onStartTour,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  verified: boolean;
  storefrontURL: string;
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
    <>
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
            borderColor: "divider",
            p: 0.45,
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(tokens.burgundy, 0.12),
              color: tokens.burgundy,
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
    </>
  );
}
