import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
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
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "0.78fr 1.22fr" },
          alignItems: "start",
        }}
      >
        <Stack spacing={2.5}>
          <ProfileSettingsForm profileSettings={profileSettings} />
          <CurrentPlatformPolicy platformSettings={platformSettings} />
        </Stack>

        <Stack spacing={2.5}>
          <NotificationPreferencesForm preferences={preferences} />
          <PlatformSettingsForm
            admin={admin}
            platformSettings={platformSettings}
            roles={roles}
          />
          <MarketingLaunchFlagsForm
            admin={admin}
            platformSettings={platformSettings}
            roles={roles}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
