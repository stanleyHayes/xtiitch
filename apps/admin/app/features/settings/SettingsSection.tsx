import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { AdminSession } from "../../lib/session";
import {
  AdminProfileSettings,
  AdminPlatformSettings,
  AdminRoleDefinition,
} from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { MetricCard } from "../../components/ui/MetricCard";
import { DetailLine } from "../shared/DetailLine";
import { StyledTimeField } from "../shared/StyledTimeField";
import { roleTone } from "../users/utils";
import { BooleanPreference } from "./BooleanPreference";
import { SectionHeader } from "../../components/ui/SectionHeader";



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
  const roleDefinition = roles.find((role) => role.role === admin.adminRole);
  const canManagePlatformSettings =
    roleDefinition?.permissions.includes("manage_settings") ??
    admin.adminRole === "owner";
  const [logoFileName, setLogoFileName] = useState("");
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
          <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
            <Form method="post">
              <input type="hidden" name="intent" value="admin-profile:update" />
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.burgundy, 0.1),
                      color: tokens.burgundy,
                    }}
                  >
                    <PersonSearchRounded />
                  </Box>
                  <Box>
                    <Typography variant="h6">Profile settings</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      This is the identity shown in admin decisions and audit
                      records.
                    </Typography>
                  </Box>
                </Stack>

                <TextField
                  name="display_name"
                  label="Display name"
                  defaultValue={profileSettings.user.displayName}
                  required
                  fullWidth
                />
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={profileSettings.user.email}
                  required
                  fullWidth
                />
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: "wrap", gap: 1 }}
                >
                  <Chip
                    size="small"
                    icon={<ShieldRounded />}
                    label={profileSettings.user.role}
                    sx={{
                      textTransform: "capitalize",
                      bgcolor: alpha(roleTone(profileSettings.user.role), 0.12),
                      color: roleTone(profileSettings.user.role),
                    }}
                  />
                  <Chip
                    size="small"
                    label={
                      profileSettings.user.isActive ? "Active" : "Inactive"
                    }
                    color={
                      profileSettings.user.isActive ? "success" : "default"
                    }
                    variant={
                      profileSettings.user.isActive ? "filled" : "outlined"
                    }
                  />
                </Stack>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<PersonSearchRounded />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save profile
                </Button>
              </Stack>
            </Form>
          </Panel>

          <Panel
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(tokens.info, 0.16),
              backgroundImage: `
                linear-gradient(135deg, ${alpha(tokens.info, 0.08)}, transparent 38%),
                linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
              `,
            }}
          >
            <Stack spacing={1.25}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                <SettingsRounded sx={{ color: tokens.burgundy }} />
                <Box>
                  <Typography variant="h6">Current platform policy</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {platformSettings.platformName} routes support through{" "}
                    {platformSettings.supportEmail}.
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <DetailLine
                label="Verification SLA"
                value={`${platformSettings.verificationSlaHours} hours`}
              />
              <DetailLine
                label="Payout review threshold"
                value={formatGHS(platformSettings.payoutReviewThresholdPesewas)}
              />
              <DetailLine
                label="Maintenance"
                value={
                  platformSettings.maintenanceMode ? "Enabled" : "Disabled"
                }
              />
              <DetailLine
                label="Updated"
                value={
                  platformSettings.updatedAt
                    ? shortTime(platformSettings.updatedAt)
                    : "Default"
                }
              />
            </Stack>
          </Panel>
        </Stack>

        <Stack spacing={2.5}>
          <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-preferences:update"
              />
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.warning, 0.12),
                      color: tokens.warning,
                    }}
                  >
                    <NotificationsActiveRounded />
                  </Box>
                  <Box>
                    <Typography variant="h6">Notification settings</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Choose how this operator receives operational alerts.
                    </Typography>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 180px" },
                  }}
                >
                  <TextField
                    name="timezone"
                    label="Timezone"
                    select
                    defaultValue={preferences.timezone}
                    required
                  >
                    <MenuItem value="Africa/Accra">Africa/Accra</MenuItem>
                    <MenuItem value="UTC">UTC</MenuItem>
                    <MenuItem value="Europe/London">Europe/London</MenuItem>
                    <MenuItem value="America/New_York">
                      America/New York
                    </MenuItem>
                  </TextField>
                  <TextField
                    name="phone_number"
                    label="SMS phone"
                    defaultValue={preferences.phoneNumber}
                    placeholder="+233501234567"
                  />
                  <StyledTimeField
                    name="daily_digest_time"
                    label="Digest time"
                    defaultValue={preferences.dailyDigestTime}
                    required
                  />
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                  }}
                >
                  <BooleanPreference
                    name="notify_email"
                    label="Email alerts"
                    helper="Send urgent account and payment updates to your inbox."
                    defaultChecked={preferences.notifyEmail}
                  />
                  <BooleanPreference
                    name="notify_sms"
                    label="SMS alerts"
                    helper="Use phone alerts for time-sensitive operations."
                    defaultChecked={preferences.notifySms}
                  />
                  <BooleanPreference
                    name="alert_verifications"
                    label="Verification queue"
                    helper="Business identity, documents, and payout readiness."
                    defaultChecked={preferences.alertVerifications}
                  />
                  <BooleanPreference
                    name="alert_money_rails"
                    label="Money rails"
                    helper="Webhook failures, payout reviews, and settlement holds."
                    defaultChecked={preferences.alertMoneyRails}
                  />
                  <BooleanPreference
                    name="alert_subscriptions"
                    label="Subscriptions"
                    helper="Plan billing, grace periods, and package usage."
                    defaultChecked={preferences.alertSubscriptions}
                  />
                  <BooleanPreference
                    name="alert_promotions"
                    label="Promotions"
                    helper="Voucher rules and pending redemption activity."
                    defaultChecked={preferences.alertPromotions}
                  />
                  <BooleanPreference
                    name="alert_risk"
                    label="Risk reviews"
                    helper="Trust, safety, fraud, and compliance escalations."
                    defaultChecked={preferences.alertRisk}
                  />
                  <BooleanPreference
                    name="alert_support"
                    label="Support queue"
                    helper="Urgent tickets and customer-impacting requests."
                    defaultChecked={preferences.alertSupport}
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<NotificationsActiveRounded />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save notifications
                </Button>
              </Stack>
            </Form>
          </Panel>

          <Panel
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(tokens.burgundy, 0.16),
            }}
          >
            <Form method="post" encType="multipart/form-data">
              <input
                type="hidden"
                name="intent"
                value="admin-platform-settings:update"
              />
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.burgundy, 0.1),
                      color: tokens.burgundy,
                    }}
                  >
                    <SettingsRounded />
                  </Box>
                  <Box>
                    <Typography variant="h6">Platform settings</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Owners can adjust global policy values used across admin
                      workflows.
                    </Typography>
                  </Box>
                </Stack>

                {!canManagePlatformSettings ? (
                  <Alert severity="info">
                    Your role can view platform settings, but cannot change
                    them.
                  </Alert>
                ) : null}

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  }}
                >
                  <TextField
                    name="platform_name"
                    label="Platform name"
                    defaultValue={platformSettings.platformName}
                    required
                    disabled={!canManagePlatformSettings}
                  />
                  <TextField
                    name="support_email"
                    label="Support email"
                    type="email"
                    defaultValue={platformSettings.supportEmail}
                    required
                    disabled={!canManagePlatformSettings}
                  />
                  <TextField
                    name="verification_sla_hours"
                    label="Verification SLA hours"
                    type="number"
                    defaultValue={platformSettings.verificationSlaHours}
                    required
                    disabled={!canManagePlatformSettings}
                    slotProps={{ htmlInput: { min: 1, max: 168, step: 1 } }}
                  />
                  <TextField
                    name="payout_review_threshold_ghs"
                    label="Payout review threshold"
                    type="number"
                    defaultValue={(
                      platformSettings.payoutReviewThresholdPesewas / 100
                    ).toFixed(2)}
                    required
                    disabled={!canManagePlatformSettings}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">GHS</InputAdornment>
                        ),
                      },
                      htmlInput: { min: 0, step: 0.01 },
                    }}
                  />
                </Box>

                <input
                  type="hidden"
                  name="brand_logo_url"
                  value={platformSettings.brandLogoUrl}
                />
                <Box
                  sx={{
                    p: 1.75,
                    border: "1px solid",
                    borderColor: alpha(tokens.ink, 0.1),
                    borderRadius: 1.5,
                    bgcolor: "rgba(var(--surface-rgb), 0.7)",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                      alignItems: { sm: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.75}
                      sx={{ alignItems: "center", minWidth: 0 }}
                    >
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 1.5,
                          border: "1px solid",
                          borderColor: alpha(tokens.ink, 0.12),
                          bgcolor: alpha(tokens.ink, 0.04),
                          display: "grid",
                          placeItems: "center",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {platformSettings.brandLogoUrl ? (
                          <Box
                            component="img"
                            src={platformSettings.brandLogoUrl}
                            alt="Current platform logo"
                            sx={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <Box
                            component="img"
                            src="/favicon.svg"
                            alt="Built-in Xtiitch mark"
                            sx={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              p: 1,
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900 }}>
                          Platform logo
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {platformSettings.brandLogoUrl
                            ? "Shown across the admin console, marketing site, dashboard, and storefronts."
                            : "Using the built-in Xtiitch mark. Upload a PNG, SVG, or WebP to rebrand every surface."}
                        </Typography>
                        {logoFileName ? (
                          <Typography
                            variant="caption"
                            sx={{ color: "primary.main", fontWeight: 800 }}
                          >
                            Selected {logoFileName} — save to apply.
                          </Typography>
                        ) : null}
                      </Box>
                    </Stack>
                    <Stack
                      spacing={1}
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      <Button
                        component="label"
                        variant="outlined"
                        disabled={!canManagePlatformSettings}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        Upload logo
                        <input
                          type="file"
                          name="brand_logo_file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          hidden
                          onChange={(event) =>
                            setLogoFileName(
                              event.currentTarget.files?.[0]?.name ?? "",
                            )
                          }
                        />
                      </Button>
                      {platformSettings.brandLogoUrl ? (
                        <FormControlLabel
                          control={
                            <Checkbox
                              name="remove_brand_logo"
                              disabled={!canManagePlatformSettings}
                            />
                          }
                          label="Remove logo"
                          sx={{ m: 0 }}
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>

                <BooleanPreference
                  name="maintenance_mode"
                  label="Maintenance mode"
                  helper="Temporarily signal that storefront and dashboard operations are restricted."
                  defaultChecked={platformSettings.maintenanceMode}
                  disabled={!canManagePlatformSettings}
                />

                <BooleanPreference
                  name="ai_assistant_addon_enabled"
                  label="AI writing add-on available"
                  helper="Master switch for the paid ✨ AI writing add-on. Off hides the purchase and stops renewals platform-wide (overrides everything). It can never be sold where no AI provider is configured."
                  defaultChecked={platformSettings.aiAssistantAddonEnabled}
                  disabled={!canManagePlatformSettings}
                />

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SettingsRounded />}
                  disabled={!canManagePlatformSettings}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save platform settings
                </Button>
              </Stack>
            </Form>
          </Panel>

          <Panel
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(tokens.info, 0.16),
            }}
          >
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-marketing-flags:update"
              />
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.info, 0.12),
                      color: tokens.info,
                    }}
                  >
                    <StorefrontRounded />
                  </Box>
                  <Box>
                    <Typography variant="h6">Marketing launch flags</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Control what is shown on the public marketing site.
                      Changes take effect immediately with no redeploy. Each
                      defaults off (hidden) for launch — turn one on once that
                      experience is ready.
                    </Typography>
                  </Box>
                </Stack>

                {!canManagePlatformSettings ? (
                  <Alert severity="info">
                    Your role can view these flags, but cannot change them.
                  </Alert>
                ) : null}

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                  }}
                >
                  <BooleanPreference
                    name="browse_store"
                    label="Browse the store"
                    helper="Show the public storefront browsing entry point on the marketing site."
                    defaultChecked={platformSettings.marketingFlags.browseStore}
                    disabled={!canManagePlatformSettings}
                  />
                  <BooleanPreference
                    name="discover"
                    label="Discover menu & featured businesses"
                    helper="Show the discovery menu and featured-business highlights."
                    defaultChecked={platformSettings.marketingFlags.discover}
                    disabled={!canManagePlatformSettings}
                  />
                  <BooleanPreference
                    name="create_store"
                    label="Create your store button"
                    helper="Show the call-to-action that lets a business start creating a store."
                    defaultChecked={platformSettings.marketingFlags.createStore}
                    disabled={!canManagePlatformSettings}
                  />
                  <BooleanPreference
                    name="pricing"
                    label="Pricing plan buttons"
                    helper="Show the pricing plans and their sign-up buttons on the marketing site."
                    defaultChecked={platformSettings.marketingFlags.pricing}
                    disabled={!canManagePlatformSettings}
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<StorefrontRounded />}
                  disabled={!canManagePlatformSettings}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save marketing flags
                </Button>
              </Stack>
            </Form>
          </Panel>
        </Stack>
      </Box>
    </Stack>
  );
}
