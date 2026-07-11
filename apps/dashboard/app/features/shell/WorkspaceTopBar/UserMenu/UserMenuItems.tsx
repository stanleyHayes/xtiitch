import { Form, Link as RouterLink } from "react-router";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import type { Profile, CurrentUser } from "../../../shared/types";
import { roleLabel } from "../../../shared/utils";

export function UserMenuItems({
  profile,
  currentUser,
  verified,
  storefrontURL,
  avatarLabel,
  onStartTour,
  onClose,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  verified: boolean;
  storefrontURL: string;
  avatarLabel: string;
  onStartTour: () => void;
  onClose: () => void;
}) {
  return (
    <>
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
            onClick={onClose}
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
          onClick={onClose}
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
          onClick={onClose}
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
            onClose();
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
    </>
  );
}
