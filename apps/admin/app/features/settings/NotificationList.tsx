import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import { tokens } from "../../theme";
import {
  AdminNotification,
  AdminProfileSettings,
  Section,
} from "../shared/types";
import { notificationToneColor } from "../shared/colors";
import {
  notificationCategoryLabel,
  notificationCategoryWatched,
} from "../shared/notifications";
import { Panel } from "../../components/ui/Panel";
import { PaginationFooter } from "../../components/ui/PaginationFooter";

export function NotificationList({
  notifications,
  preferences,
  page,
  pageCount,
  total,
  onPageChange,
  onSelect,
}: {
  notifications: AdminNotification[];
  preferences: AdminProfileSettings["preferences"];
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onSelect: (section: Section) => void;
}) {
  return (
    <Stack spacing={1.5}>
      {notifications.map((notification) => {
        const color = notificationToneColor(notification.tone);
        const watched = notificationCategoryWatched(
          notification.category,
          preferences,
        );
        return (
          <Panel
            key={notification.id}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(color, 0.22),
              backgroundImage: `
                linear-gradient(90deg, ${alpha(color, 0.08)}, transparent 38%),
                linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
              `,
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: alpha(color, 0.36),
                boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
              },
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ justifyContent: "space-between" }}
            >
              <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(color, 0.12),
                    color,
                    flex: "0 0 auto",
                  }}
                >
                  <NotificationsActiveRounded />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      {notification.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={notificationCategoryLabel(notification.category)}
                      variant="outlined"
                      sx={{
                        borderColor: alpha(color, 0.28),
                        color,
                        fontWeight: 900,
                      }}
                    />
                    <Chip
                      size="small"
                      label={watched ? notification.tone : "muted"}
                      sx={{
                        bgcolor: alpha(watched ? color : tokens.ink, 0.1),
                        color: watched ? color : "text.secondary",
                        textTransform: "capitalize",
                        fontWeight: 900,
                      }}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: "text.secondary" }}
                  >
                    {notification.source} · {notification.meta}
                  </Typography>
                  <Typography sx={{ mt: 0.75 }}>
                    {notification.helper}
                  </Typography>
                </Box>
              </Stack>
              <Button
                variant={
                  notification.tone === "success" || !watched
                    ? "outlined"
                    : "contained"
                }
                endIcon={<ArrowForwardRounded />}
                onClick={() => onSelect(notification.target)}
                sx={{
                  alignSelf: { xs: "flex-start", md: "center" },
                  whiteSpace: "nowrap",
                }}
              >
                {notification.targetLabel}
              </Button>
            </Stack>
          </Panel>
        );
      })}
      <PaginationFooter
        count={pageCount}
        label="alerts"
        page={page}
        pageSize={6}
        total={total}
        onChange={onPageChange}
      />
      {notifications.length === 0 ? (
        <Panel sx={{ p: 3, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 900 }}>
            No alerts in this lane.
          </Typography>
          <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
            Choose another triage lane or return to all alerts.
          </Typography>
        </Panel>
      ) : null}
    </Stack>
  );
}
