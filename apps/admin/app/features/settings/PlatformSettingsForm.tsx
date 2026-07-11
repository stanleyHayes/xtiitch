import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { AdminSession } from "../../lib/session";
import { AdminPlatformSettings, AdminRoleDefinition } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { BooleanPreference } from "./BooleanPreference";

export function PlatformSettingsForm({
  admin,
  platformSettings,
  roles,
}: {
  admin: AdminSession;
  platformSettings: AdminPlatformSettings;
  roles: AdminRoleDefinition[];
}) {
  const roleDefinition = roles.find((role) => role.role === admin.adminRole);
  const canManagePlatformSettings =
    roleDefinition?.permissions.includes("manage_settings") ??
    admin.adminRole === "owner";
  const [logoFileName, setLogoFileName] = useState("");

  return (
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
  );
}
