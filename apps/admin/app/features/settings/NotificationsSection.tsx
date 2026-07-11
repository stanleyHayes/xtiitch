import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import {
  AdminNotification,
  AdminNotificationCategory,
  AdminNotificationFilter,
  Section,
  AdminProfileSettings,
} from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { NotificationList } from "./NotificationList";
import { NotificationPreferences } from "./NotificationPreferences";
import { notificationCategoryWatched } from "../shared/notifications";

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

export function NotificationsSection({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
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
  const categoryFilters = notificationFilters
    .filter(
      (
        item,
      ): item is {
        value: AdminNotificationCategory;
        label: string;
      } => item.value !== "all",
    )
    .map((item) => ({ value: item.value, label: item.label }));

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
        <NotificationList
          notifications={pagedNotifications}
          preferences={preferences}
          page={notificationPage}
          pageCount={notificationPageCount}
          total={visibleNotifications.length}
          onPageChange={setNotificationPage}
          onSelect={onSelect}
        />
        <NotificationPreferences
          filters={categoryFilters}
          notifications={notifications}
          preferences={preferences}
          routeRows={routeRows}
          onSelect={onSelect}
        />
      </Box>
    </Stack>
  );
}
