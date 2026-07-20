import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { tokens } from "../../theme";
import type { AdminSession } from "../../lib/session";
import { AdminPlatformSettings, AdminRoleDefinition } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { BooleanPreference } from "./BooleanPreference";
import { useFormResetKey } from "../shared/useActionSuccess";

export function MarketingLaunchFlagsForm({
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
  // §1.2/§11.4: re-mount on successful save so the uncontrolled toggles
  // re-seed from the revalidated loader data.
  const resetKey = useFormResetKey("settings");

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.info, 0.16),
      }}
    >
      <Form key={resetKey} method="post">
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
  );
}
