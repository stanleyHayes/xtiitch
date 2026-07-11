import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { tokens } from "../../theme";
import {
  AdminNotification,
  AdminNotificationCategory,
  AdminNotificationFilter,
  Section,
  AdminProfileSettings,
} from "../shared/types";
import { notificationToneColor } from "../shared/colors";
import { notificationCategoryLabel, notificationCategoryWatched } from "../shared/notifications";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function NotificationsSection({
  notifications,
  notificationsError,
  preferences,
  onSelect,
}: {
  notifications: AdminNotification[];
  notificationsError: string | null;
  preferences: AdminProfileSettings["preferences"];
  onSelect: (section: Section) => void;
}) {
  const [filter, setFilter] = useState<AdminNotificationFilter>("all");
  const notificationFilters: {
    value: AdminNotificationFilter;
    label: string;
  }[] = [
    { value: "all", label: "All" },
    { value: "verification", label: "Verification" },
    { value: "money", label: "Money" },
    { value: "subscriptions", label: "Subscriptions" },
    { value: "promotions", label: "Promotions" },
    { value: "ads", label: "Ads" },
    { value: "affiliates", label: "Affiliates" },
    { value: "referrals", label: "Referrals" },
    { value: "risk", label: "Risk" },
    { value: "support", label: "Support" },
    { value: "platform", label: "Platform" },
    { value: "audit", label: "Audit" },
  ];
  const actionableNotifications = notifications.filter(
    (notification) =>
      notification.id !== "all-clear" &&
      notificationCategoryWatched(notification.category, preferences),
  );
  const mutedNotifications = notifications.filter(
    (notification) =>
      notification.id !== "all-clear" &&
      !notificationCategoryWatched(notification.category, preferences),
  ).length;
  const actionableCount = actionableNotifications.length;
  const criticalCount = actionableNotifications.filter(
    (notification) => notification.tone === "critical",
  ).length;
  const visibleNotifications = notifications.filter(
    (notification) => filter === "all" || notification.category === filter,
  );
  const {
    page: notificationPage,
    pageCount: notificationPageCount,
    pagedItems: pagedNotifications,
    setPage: setNotificationPage,
  } = usePagedItems(visibleNotifications, 6, filter);
  const categoryRows = notificationFilters
    .filter(
      (
        item,
      ): item is {
        value: AdminNotificationCategory;
        label: string;
      } => item.value !== "all",
    )
    .map((item) => {
      const count = notifications.filter(
        (notification) => notification.category === item.value,
      ).length;
      return {
        ...item,
        count: count === 1 && notifications[0]?.id === "all-clear" ? 0 : count,
        watched: notificationCategoryWatched(item.value, preferences),
      };
    });
  const routeRows = [
    {
      label: "Email",
      value: preferences.notifyEmail ? "On" : "Off",
      active: preferences.notifyEmail,
    },
    {
      label: "SMS",
      value: preferences.notifySms ? "On" : "Off",
      active: preferences.notifySms,
    },
    {
      label: "Verification",
      value: preferences.alertVerifications ? "Watched" : "Muted",
      active: preferences.alertVerifications,
    },
    {
      label: "Money rails",
      value: preferences.alertMoneyRails ? "Watched" : "Muted",
      active: preferences.alertMoneyRails,
    },
    {
      label: "Subscriptions",
      value: preferences.alertSubscriptions ? "Watched" : "Muted",
      active: preferences.alertSubscriptions,
    },
    {
      label: "Promotions",
      value: preferences.alertPromotions ? "Watched" : "Muted",
      active: preferences.alertPromotions,
    },
    {
      label: "Risk",
      value: preferences.alertRisk ? "Watched" : "Muted",
      active: preferences.alertRisk,
    },
    {
      label: "Support",
      value: preferences.alertSupport ? "Watched" : "Muted",
      active: preferences.alertSupport,
    },
  ];

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Admin alerts"
        title="Notifications"
        helper="A live action center for verification, money rails, risk, and support signals."
      />
      {notificationsError ? (
        <Alert severity="warning">{notificationsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MetricCard
          label="Open alerts"
          value={String(actionableCount)}
          helper="Watched queue signals"
          trend={criticalCount > 0 ? `${criticalCount} critical` : "Stable"}
        />
        <MetricCard
          label="Muted signals"
          value={String(mutedNotifications)}
          helper="Visible, not routed"
          trend={mutedNotifications > 0 ? "Preferences" : "None muted"}
        />
        <MetricCard
          label="Digest time"
          value={preferences.dailyDigestTime}
          helper={preferences.timezone}
          trend={preferences.notifyEmail ? "Email on" : "Email off"}
        />
        <MetricCard
          label="Alert routing"
          value={
            routeRows.filter((row) => row.active).length === routeRows.length
              ? "Full"
              : "Custom"
          }
          helper={`${routeRows.filter((row) => row.active).length} active routes`}
          trend={preferences.notifySms ? "SMS on" : "SMS off"}
        />
      </Box>

      <Panel sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          sx={{ alignItems: { lg: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">Triage lanes</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {actionableCount} watched alerts · {mutedNotifications} muted
              signals
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, nextFilter: AdminNotificationFilter | null) => {
              if (nextFilter) {
                setFilter(nextFilter);
              }
            }}
            sx={{
              flexWrap: "wrap",
              gap: 0.75,
              "& .MuiToggleButton-root": {
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.12),
                borderRadius: 1.25,
                px: 1.4,
                fontWeight: 900,
                "&.Mui-selected": {
                  bgcolor: alpha(tokens.burgundy, 0.1),
                  color: tokens.burgundy,
                },
              },
              "& .MuiToggleButtonGroup-grouped": {
                m: 0,
                borderRadius: 1.25,
              },
            }}
          >
            {notificationFilters.map((item) => (
              <ToggleButton key={item.value} value={item.value}>
                {item.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Panel>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.25fr) 360px" },
          alignItems: "start",
        }}
      >
        <Stack spacing={1.5}>
          {pagedNotifications.map((notification) => {
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
                          label={notificationCategoryLabel(
                            notification.category,
                          )}
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
            count={notificationPageCount}
            label="alerts"
            page={notificationPage}
            pageSize={6}
            total={visibleNotifications.length}
            onChange={setNotificationPage}
          />
          {visibleNotifications.length === 0 ? (
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
      </Box>
    </Stack>
  );
}
