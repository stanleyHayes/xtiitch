import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { tokens } from "../../theme";
import {
  AdminNotification,
  AdminNotificationCategory,
  AdminProfileSettings,
  Section,
} from "../shared/types";
import { notificationCategoryWatched } from "../shared/notifications";
import { Panel } from "../../components/ui/Panel";

export function NotificationPreferences({
  filters,
  notifications,
  preferences,
  routeRows,
  onSelect,
}: {
  filters: { value: AdminNotificationCategory; label: string }[];
  notifications: AdminNotification[];
  preferences: AdminProfileSettings["preferences"];
  routeRows: {
    label: string;
    value: string;
    active: boolean;
  }[];
  onSelect: (section: Section) => void;
}) {
  const categoryRows = filters.map((item) => {
    const count = notifications.filter(
      (notification) => notification.category === item.value,
    ).length;
    return {
      ...item,
      count: count === 1 && notifications[0]?.id === "all-clear" ? 0 : count,
      watched: notificationCategoryWatched(item.value, preferences),
    };
  });

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.warning, 0.18),
        backgroundImage: `
          radial-gradient(circle at 96% 0%, ${alpha(tokens.warning, 0.16)}, transparent 36%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <NotificationsActiveRounded sx={{ color: tokens.burgundy }} />
          <Box>
            <Typography variant="h6">Notification routing</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Current delivery and watched categories for this operator.
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <Stack spacing={1}>
          {categoryRows.map((row) => (
            <Box
              key={row.value}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: alpha(
                  row.watched ? tokens.info : tokens.ink,
                  row.watched ? 0.18 : 0.12,
                ),
                bgcolor: row.watched
                  ? alpha(tokens.info, 0.045)
                  : alpha(tokens.ink, 0.025),
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>
                    {row.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 800 }}
                  >
                    {row.count} signals
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={row.watched ? "Watched" : "Muted"}
                  sx={{
                    bgcolor: alpha(
                      row.watched ? tokens.info : tokens.ink,
                      row.watched ? 0.12 : 0.08,
                    ),
                    color: row.watched ? tokens.info : "text.secondary",
                    fontWeight: 900,
                  }}
                />
              </Stack>
            </Box>
          ))}
          <Divider />
          {routeRows.map((row) => (
            <Box
              key={row.label}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: alpha(
                  row.active ? tokens.success : tokens.ink,
                  row.active ? 0.18 : 0.12,
                ),
                bgcolor: row.active
                  ? alpha(tokens.success, 0.055)
                  : alpha(tokens.ink, 0.025),
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  {row.label}
                </Typography>
                <Chip
                  size="small"
                  label={row.value}
                  sx={{
                    bgcolor: alpha(
                      row.active ? tokens.success : tokens.ink,
                      row.active ? 0.12 : 0.08,
                    ),
                    color: row.active ? tokens.success : "text.secondary",
                    fontWeight: 900,
                  }}
                />
              </Stack>
            </Box>
          ))}
        </Stack>
        <Button
          variant="outlined"
          startIcon={<SettingsRounded />}
          onClick={() => onSelect("settings")}
        >
          Edit notification settings
        </Button>
      </Stack>
    </Panel>
  );
}
