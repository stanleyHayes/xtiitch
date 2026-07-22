import Alert from "@mui/material/Alert";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import RocketLaunchRounded from "@mui/icons-material/RocketLaunchRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import type { AdminSession } from "../../lib/session";
import {
  AdminProfileSettings,
  AdminPlatformSettings,
  AdminRoleDefinition,
} from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { ProfileSettingsForm } from "./ProfileSettingsForm";
import { CurrentPlatformPolicy } from "./CurrentPlatformPolicy";
import { NotificationPreferencesForm } from "./NotificationPreferencesForm";
import { PlatformSettingsForm } from "./PlatformSettingsForm";
import { MarketingLaunchFlagsForm } from "./MarketingLaunchFlagsForm";
import { Panel } from "../../components/ui/Panel";
import { useActionSuccess } from "../shared/useActionSuccess";

type SettingsPanel = "profile" | "notifications" | "platform" | "launch";

function SettingsActionCard({
  icon,
  title,
  helper,
  value,
  action,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  helper: string;
  value: string;
  action: string;
  onOpen: () => void;
}) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              color: "primary.main",
              display: "grid",
              placeItems: "center",
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {helper}
            </Typography>
          </Box>
        </Stack>
        <Typography sx={{ fontWeight: 900 }}>{value}</Typography>
        <Button
          variant="outlined"
          endIcon={<ArrowForwardRounded />}
          onClick={onOpen}
          sx={{ mt: "auto", alignSelf: "flex-start" }}
        >
          {action}
        </Button>
      </Stack>
    </Panel>
  );
}

function SettingsDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={{
        "& .MuiDialog-paper": {
          m: { xs: 0, sm: 4 },
          width: { xs: "100%", sm: "calc(100% - 64px)" },
          height: { xs: "100%", sm: "auto" },
          maxHeight: { xs: "100%", sm: "calc(100% - 64px)" },
          borderRadius: { xs: 0, sm: 2 },
        },
      }}
    >
      <DialogTitle component="div">
        <Stack direction="row" sx={{ alignItems: "center" }}>
          <Typography variant="h5" sx={{ flex: 1 }}>
            {title}
          </Typography>
          <IconButton aria-label={`Close ${title}`} onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.25, sm: 2.5 } }}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function SettingsSection({
  admin,
  profileSettings,
  profileSettingsError,
  platformSettings,
  platformSettingsError,
  roles,
}: {
  admin: AdminSession;
  profileSettings: AdminProfileSettings;
  profileSettingsError: string | null;
  platformSettings: AdminPlatformSettings;
  platformSettingsError: string | null;
  roles: AdminRoleDefinition[];
}) {
  const preferences = profileSettings.preferences;
  const [activePanel, setActivePanel] = useState<SettingsPanel | null>(null);
  const actionSuccess = useActionSuccess("settings");
  useEffect(() => {
    if (actionSuccess) setActivePanel(null);
  }, [actionSuccess]);
  const launchEnabledCount = Object.values(
    platformSettings.marketingFlags,
  ).filter(Boolean).length;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Workspace settings"
        title="Profile, platform settings, and notifications"
        helper="Keep operator identity, alert routing, and platform policy controls in one place."
      />

      {profileSettingsError ? (
        <Alert severity="warning">{profileSettingsError}</Alert>
      ) : null}
      {platformSettingsError ? (
        <Alert severity="warning">{platformSettingsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <MetricCard
          label="Signed in as"
          value={profileSettings.user.displayName}
          helper={profileSettings.user.email}
          trend={profileSettings.user.role}
        />
        <MetricCard
          label="Daily digest"
          value={preferences.dailyDigestTime}
          helper={preferences.timezone}
          trend={preferences.notifyEmail ? "Email on" : "Email off"}
        />
        <MetricCard
          label="Review threshold"
          value={formatGHS(platformSettings.payoutReviewThresholdPesewas)}
          helper={`${platformSettings.verificationSlaHours}h verification SLA`}
          trend={platformSettings.maintenanceMode ? "Maintenance on" : "Live"}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
        }}
      >
        <SettingsActionCard
          icon={<PersonSearchRounded />}
          title="Operator profile"
          helper="Identity used in decisions and audit records."
          value={`${profileSettings.user.displayName} · ${profileSettings.user.email}`}
          action="Edit profile"
          onOpen={() => setActivePanel("profile")}
        />
        <SettingsActionCard
          icon={<NotificationsActiveRounded />}
          title="Notification routing"
          helper="Channels, alert categories, and digest schedule."
          value={`${preferences.notifyEmail ? "Email on" : "Email off"} · ${preferences.dailyDigestTime} ${preferences.timezone}`}
          action="Manage notifications"
          onOpen={() => setActivePanel("notifications")}
        />
        <SettingsActionCard
          icon={<SettingsRounded />}
          title="Platform policy"
          helper="Branding, tax, verification, payouts, and maintenance."
          value={`${platformSettings.vatRateBps / 100}% tax fee · ${platformSettings.verificationSlaHours}h verification SLA`}
          action="Open platform settings"
          onOpen={() => setActivePanel("platform")}
        />
        <SettingsActionCard
          icon={<RocketLaunchRounded />}
          title="Marketing launch"
          helper="Reveal public marketing links without a redeploy."
          value={`${launchEnabledCount}/4 public links live`}
          action="Open launch controls"
          onOpen={() => setActivePanel("launch")}
        />
      </Box>

      <CurrentPlatformPolicy platformSettings={platformSettings} />

      <SettingsDialog
        open={activePanel === "profile"}
        title="Edit operator profile"
        onClose={() => setActivePanel(null)}
      >
        <ProfileSettingsForm profileSettings={profileSettings} />
      </SettingsDialog>
      <SettingsDialog
        open={activePanel === "notifications"}
        title="Notification routing"
        onClose={() => setActivePanel(null)}
      >
        <NotificationPreferencesForm preferences={preferences} />
      </SettingsDialog>
      <SettingsDialog
        open={activePanel === "platform"}
        title="Platform settings"
        onClose={() => setActivePanel(null)}
      >
        <PlatformSettingsForm
          admin={admin}
          platformSettings={platformSettings}
          roles={roles}
        />
      </SettingsDialog>
      <SettingsDialog
        open={activePanel === "launch"}
        title="Marketing launch controls"
        onClose={() => setActivePanel(null)}
      >
        <MarketingLaunchFlagsForm
          admin={admin}
          platformSettings={platformSettings}
          roles={roles}
        />
      </SettingsDialog>
    </Stack>
  );
}
