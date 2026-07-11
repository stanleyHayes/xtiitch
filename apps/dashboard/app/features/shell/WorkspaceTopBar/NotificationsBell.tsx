import { Link as RouterLink } from "react-router";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import { tokens } from "../../../theme";

export function NotificationsBell({
  notificationCount,
  darkChrome,
}: {
  notificationCount: number;
  darkChrome: boolean;
}) {
  return (
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
  );
}
