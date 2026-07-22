import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import {
  AdminNotification,
  AdminNotificationFilter,
  Section,
  AdminProfileSettings,
} from "../shared/types";
import { notificationToneColor } from "../shared/colors";
import { notificationCategoryLabel, notificationCategoryWatched } from "../shared/notifications";
import { AdminEmptyState, AdminRecordPage, MetricCard, PaginationFooter, Panel, SectionHeader } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import { NotificationPreferences } from "./NotificationPreferences";

const filters: { value: AdminNotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "money", label: "Money" },
  { value: "verification", label: "Verification" },
  { value: "risk", label: "Risk" },
  { value: "support", label: "Support" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "platform", label: "Platform" },
  { value: "audit", label: "Audit" },
];

// eslint-disable-next-line complexity -- coordinates filtering, record routing, and the routing preferences dialog
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<AdminNotificationFilter>("all");
  const [routingOpen, setRoutingOpen] = useState(false);
  const selectedId = searchParams.get("case");
  const selected = notifications.find((item) => item.id === selectedId) ?? null;
  const visible = useMemo(
    () => notifications.filter((item) => item.id !== "all-clear" && (filter === "all" || item.category === filter)),
    [filter, notifications],
  );
  const watched = notifications.filter((item) => item.id !== "all-clear" && notificationCategoryWatched(item.category, preferences));
  const criticalCount = watched.filter((item) => item.tone === "critical").length;
  const { page, pageCount, pagedItems, setPage } = usePagedItems(visible, 8, filter);
  const closeCase = () => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("case"); return next; });

  if (selected) {
    const color = notificationToneColor(selected.tone);
    return (
      <AdminRecordPage
        eyebrow={`${notificationCategoryLabel(selected.category)} case`}
        title={selected.title}
        helper={`${selected.source} · ${selected.meta}`}
        status={selected.tone}
        statusColor={color}
        onBack={closeCase}
        actions={
          <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => onSelect(selected.target)}>
            Open workspace
          </Button>
        }
      >
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.4fr) minmax(260px, .6fr)" } }}>
          <Box>
            <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 900 }}>What happened</Typography>
            <Typography sx={{ mt: 1, fontSize: 18 }}>{selected.helper}</Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(color, 0.07), border: "1px solid", borderColor: alpha(color, 0.18) }}>
            <Typography variant="overline" sx={{ color, fontWeight: 900 }}>Recommended next step</Typography>
            <Typography sx={{ mt: 0.75, fontWeight: 800 }}>{selected.targetLabel}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>Use the linked workspace to investigate and complete the operational action.</Typography>
          </Box>
        </Box>
      </AdminRecordPage>
    );
  }

  const routeRows = [
    { label: "Email", value: preferences.notifyEmail ? "On" : "Off", active: preferences.notifyEmail },
    { label: "SMS", value: preferences.notifySms ? "On" : "Off", active: preferences.notifySms },
    { label: "Verification", value: preferences.alertVerifications ? "Watched" : "Muted", active: preferences.alertVerifications },
    { label: "Money rails", value: preferences.alertMoneyRails ? "Watched" : "Muted", active: preferences.alertMoneyRails },
    { label: "Subscriptions", value: preferences.alertSubscriptions ? "Watched" : "Muted", active: preferences.alertSubscriptions },
    { label: "Promotions", value: preferences.alertPromotions ? "Watched" : "Muted", active: preferences.alertPromotions },
    { label: "Risk", value: preferences.alertRisk ? "Watched" : "Muted", active: preferences.alertRisk },
    { label: "Support", value: preferences.alertSupport ? "Watched" : "Muted", active: preferences.alertSupport },
  ];

  return (
    <Stack spacing={2.5}>
      <SectionHeader eyebrow="Operational inbox" title="What needs attention" helper="A focused queue of platform issues. Open a case for context and action; details never crowd the list." />
      {notificationsError ? <Alert severity="warning">{notificationsError}</Alert> : null}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" } }}>
        <MetricCard label="Open cases" value={String(watched.length)} helper="Watched operational signals" trend={criticalCount ? `${criticalCount} critical` : "Stable"} />
        <MetricCard label="Critical" value={String(criticalCount)} helper="Requires immediate review" trend={criticalCount ? "Act now" : "All clear"} />
        <MetricCard label="Muted" value={String(notifications.length - watched.length)} helper="Visible outside routing" trend="Preferences" />
        <MetricCard label="Daily digest" value={preferences.dailyDigestTime} helper={preferences.timezone} trend={preferences.notifyEmail ? "Email on" : "Email off"} />
      </Box>
      <Panel sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { lg: "center" } }}>
          <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, value) => value && setFilter(value)} sx={{ flexWrap: "wrap", gap: .75, "& .MuiToggleButton-root": { m: 0, borderRadius: "999px !important", px: 1.5, fontWeight: 900 } }}>
            {filters.map((item) => <ToggleButton key={item.value} value={item.value}>{item.label}</ToggleButton>)}
          </ToggleButtonGroup>
          <Button variant="outlined" startIcon={<TuneRounded />} onClick={() => setRoutingOpen(true)} sx={{ whiteSpace: "nowrap" }}>Routing settings</Button>
        </Stack>
      </Panel>
      <Panel sx={{ overflow: "hidden" }}>
        {pagedItems.map((item, index) => {
          const color = notificationToneColor(item.tone);
          return (
            <Box key={item.id} component="button" type="button" onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("case", item.id); return next; })}
              sx={{ width: "100%", p: { xs: 2, md: 2.25 }, display: "grid", gridTemplateColumns: { xs: "auto 1fr auto", md: "auto minmax(0, 1.4fr) minmax(180px, .6fr) auto" }, gap: 1.5, alignItems: "center", border: 0, borderBottom: index === pagedItems.length - 1 ? 0 : "1px solid", borderColor: "divider", bgcolor: "transparent", color: "text.primary", textAlign: "left", cursor: "pointer", font: "inherit", "&:hover": { bgcolor: alpha(color, .055) } }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: alpha(color, .11), color }}><NotificationsActiveRounded fontSize="small" /></Box>
              <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 900 }}>{item.title}</Typography><Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.helper}</Typography></Box>
              <Typography variant="body2" sx={{ display: { xs: "none", md: "block" }, color: "text.secondary" }}>{item.source} · {item.meta}</Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Chip size="small" label={item.tone} sx={{ display: { xs: "none", sm: "flex" }, bgcolor: alpha(color, .11), color, textTransform: "capitalize" }} /><ArrowForwardRounded sx={{ color }} /></Stack>
            </Box>
          );
        })}
        {visible.length === 0 ? <AdminEmptyState compact icon={<NotificationsActiveRounded />} eyebrow="Operations inbox" title="Nothing needs attention" helper="New payment, risk, support, and verification signals will appear here." /> : null}
      </Panel>
      <PaginationFooter count={pageCount} label="cases" page={page} pageSize={8} total={visible.length} onChange={setPage} />
      <Dialog open={routingOpen} onClose={() => setRoutingOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Notification routing<IconButton onClick={() => setRoutingOpen(false)}><CloseRounded /></IconButton></DialogTitle>
        <DialogContent><NotificationPreferences filters={filters.filter((item) => item.value !== "all") as { value: Exclude<AdminNotificationFilter, "all">; label: string }[]} notifications={notifications} preferences={preferences} routeRows={routeRows} onSelect={onSelect} /></DialogContent>
      </Dialog>
    </Stack>
  );
}
