import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { AdminProfileSettings } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { roleTone } from "../users/utils";
import { useFormResetKey } from "../shared/useActionSuccess";

export function ProfileSettingsForm({
  profileSettings,
}: {
  profileSettings: AdminProfileSettings;
}) {
  // §1.2/§11.4: re-mount on successful save so the uncontrolled fields
  // re-seed from the revalidated loader data.
  const resetKey = useFormResetKey("settings");

  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Form key={resetKey} method="post">
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
  );
}
