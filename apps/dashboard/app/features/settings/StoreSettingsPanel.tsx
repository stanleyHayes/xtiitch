import { Form, Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import PaletteRounded from "@mui/icons-material/PaletteRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { StoreSettings, Profile } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { enabledStoreSettings, storeFeatureSwitches } from "./utils";
import { PlanGatedControl } from "../../components/ui/PlanGatedControl";
import { StorefrontImageUploadField } from "../studio/StorefrontImageUploadField";
import {
  ACTIVATION_PATH,
  activationPlanLabel,
  activationPromptMessage,
} from "../../lib/activation";

export function StoreSettingsPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  settings,
  profile,
  error,
  pendingActivation,
}: {
  settings: StoreSettings;
  profile: Profile;
  error?: string;
  pendingActivation: boolean;
}) {
  const featureSwitches = storeFeatureSwitches(settings);

  const planLabel = activationPlanLabel({
    plan_name: "",
    plan_code: profile.plan,
  });

  return (
    <Panel id="settings">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <SettingsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
                Storefront settings
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Shape what customers see and which request paths are available.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${enabledStoreSettings(settings)} features on`}
            tone={tokens.burgundy}
          />
        </Stack>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        {pendingActivation ? (
          // Paid plan pending activation: saving would 402 server-side, so send
          // the owner to the activation page with a clear prompt instead.
          <Alert
            severity="info"
            sx={{ mt: 2 }}
            action={
              <Button
                component={RouterLink}
                to={ACTIVATION_PATH}
                color="inherit"
                size="small"
              >
                Activate now
              </Button>
            }
          >
            {activationPromptMessage(planLabel)}.
          </Alert>
        ) : null}

        <Form method="post" encType="multipart/form-data">
          <input type="hidden" name="intent" value="save_store_settings" />
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gap: 1.5,
              alignItems: "start",
              gridTemplateColumns: {
                xs: "1fr",
                xl: "minmax(340px, 0.9fr) minmax(0, 1.1fr)",
              },
            }}
          >
            <Box
              sx={{
                p: { xs: 1.5, md: 1.75 },
                border: "1px solid",
                borderColor: (theme) =>
                  alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.26 : 0.18,
                  ),
                borderRadius: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? alpha(tokens.white, 0.04)
                    : "rgba(var(--surface-rgb), 0.76)",
                backgroundImage: `linear-gradient(135deg, ${alpha(
                  settings.brand_color || tokens.burgundy,
                  0.11,
                )}, transparent 52%)`,
              }}
            >
              <Stack
                direction="row"
                spacing={1.25}
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.25,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ alignItems: "center", minWidth: 0 }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      color: tokens.white,
                      bgcolor: settings.brand_color || tokens.burgundy,
                      border: "1px solid",
                      borderColor: alpha(tokens.ink, 0.12),
                      flexShrink: 0,
                    }}
                  >
                    <PaletteRounded />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {profile.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Public identity
                    </Typography>
                  </Box>
                </Stack>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 800,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {settings.layout_variant || "standard"}
                </Typography>
              </Stack>
              <Box
                sx={{
                  mt: 1.5,
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    xl: "1fr",
                  },
                }}
              >
                <PlanGatedControl
                  locked={!(profile.entitlements ?? {}).custom_brand_color}
                  title="Brand colour"
                  description="Used on the public store header and customer trust moments."
                >
                  <TextField
                    name="brand_color"
                    type="color"
                    defaultValue={settings.brand_color || tokens.burgundy}
                    fullWidth
                    size="small"
                  />
                </PlanGatedControl>
                <PlanGatedControl
                  locked={!(profile.entitlements ?? {}).custom_logo}
                  title="Storefront logo"
                  description="Shown on the storefront in place of the Xtiitch mark."
                >
                  <StorefrontImageUploadField
                    name="logo"
                    currentUrl={settings.logo_url}
                  />
                </PlanGatedControl>
                <PlanGatedControl
                  locked={!(profile.entitlements ?? {}).custom_banner}
                  title="Hero banner image"
                  description="Replaces the default storefront hero image."
                >
                  <StorefrontImageUploadField
                    name="banner"
                    currentUrl={settings.banner_url}
                  />
                </PlanGatedControl>
                <PlanGatedControl
                  locked={!(profile.entitlements ?? {}).custom_layout}
                  title="Storefront layout"
                  description="How the storefront hero is composed."
                >
                  <TextField
                    select
                    name="layout_variant"
                    defaultValue={settings.layout_variant || "standard"}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="spotlight">Spotlight</MenuItem>
                    <MenuItem value="minimal">Minimal</MenuItem>
                  </TextField>
                </PlanGatedControl>
              </Box>
            </Box>

            <Box
              sx={{
                p: { xs: 1.5, md: 1.75 },
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? alpha(tokens.white, 0.035)
                    : "rgba(var(--surface-rgb), 0.72)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  alignItems: { xs: "flex-start", sm: "center" },
                  justifyContent: "space-between",
                  mb: 1.25,
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>
                    Customer request paths
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Enable only the storefront actions your team is ready to
                    handle.
                  </Typography>
                </Box>
                <ToneChip
                  label={`${enabledStoreSettings(settings)} active`}
                  tone={tokens.burgundy}
                />
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                }}
              >
                {featureSwitches.map((feature) => (
                  <Box
                    key={feature.name}
                    component="label"
                    sx={{
                      p: 1.25,
                      border: "1px solid",
                      borderColor: (theme) =>
                        feature.checked
                          ? alpha(theme.palette.primary.main, 0.28)
                          : theme.palette.divider,
                      borderRadius: 2,
                      bgcolor: (theme) =>
                        feature.checked
                          ? alpha(
                              theme.palette.primary.main,
                              theme.palette.mode === "dark" ? 0.14 : 0.07,
                            )
                          : theme.palette.mode === "dark"
                            ? alpha(tokens.white, 0.03)
                            : "rgba(var(--surface-rgb), 0.66)",
                      cursor: "pointer",
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      alignItems: "flex-start",
                    }}
                  >
                    <Checkbox
                      name={feature.name}
                      defaultChecked={feature.checked}
                      sx={{ p: 0.2, mt: 0.2 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }}>
                        {feature.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 0.25,
                          color: "text.secondary",
                          display: "block",
                          lineHeight: 1.55,
                        }}
                      >
                        {feature.helper}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: { xs: "stretch", sm: "flex-end" },
            }}
          >
            {pendingActivation ? (
              <Button
                component={RouterLink}
                to={ACTIVATION_PATH}
                variant="contained"
                startIcon={<LockRounded />}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                Activate to save settings
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveRounded />}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                Save storefront settings
              </Button>
            )}
          </Box>
        </Form>
      </Box>
    </Panel>
  );
}
