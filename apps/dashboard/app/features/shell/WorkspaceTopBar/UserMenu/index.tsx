import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../../theme";
import type { Profile, CurrentUser } from "../../../shared/types";
import { UserMenuItems } from "./UserMenuItems";

export function UserMenu({
  profile,
  currentUser,
  verified,
  storefrontURL,
  pendingActivation,
  onStartTour,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  verified: boolean;
  storefrontURL: string;
  pendingActivation: boolean;
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
        <UserMenuItems
          profile={profile}
          currentUser={currentUser}
          verified={verified}
          storefrontURL={storefrontURL}
          pendingActivation={pendingActivation}
          avatarLabel={avatarLabel}
          onStartTour={onStartTour}
          onClose={closeProfileMenu}
        />
      </Menu>
    </>
  );
}
