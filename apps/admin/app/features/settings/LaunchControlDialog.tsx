import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import RocketLaunchRounded from "@mui/icons-material/RocketLaunchRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import type { AdminSession } from "../../lib/session";
import type {
  AdminPlatformSettings,
  AdminRoleDefinition,
} from "../shared/types";
import { MarketingLaunchFlagsForm } from "./MarketingLaunchFlagsForm";

export function LaunchControlDialog({
  open,
  onClose,
  admin,
  platformSettings,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  admin: AdminSession;
  platformSettings: AdminPlatformSettings;
  roles: AdminRoleDefinition[];
}) {
  const enabledCount = Object.values(platformSettings.marketingFlags).filter(
    Boolean,
  ).length;
  const roleDefinition = roles.find((role) => role.role === admin.adminRole);
  const canManage =
    roleDefinition?.permissions.includes("manage_settings") ??
    admin.adminRole === "owner";

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
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <RocketLaunchRounded color="primary" />
              <Typography variant="h5">Launch controls</Typography>
              <Chip
                size="small"
                color={enabledCount === 4 ? "success" : "warning"}
                label={`${enabledCount}/4 links live`}
              />
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 0.75, color: "text.secondary" }}
            >
              These switches control the public links on xtiitch.com
              immediately. Launch readiness is guidance; these are the controls
              that actually reveal the marketing paths.
            </Typography>
          </Box>
          <IconButton aria-label="Close launch controls" onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "center" } }}
          >
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-marketing-flags:update"
              />
              {(
                ["browse_store", "discover", "create_store", "pricing"] as const
              ).map((name) => (
                <input key={name} type="hidden" name={name} value="on" />
              ))}
              <Button
                type="submit"
                variant="contained"
                startIcon={<RocketLaunchRounded />}
                disabled={!canManage || enabledCount === 4}
              >
                Enable all public links
              </Button>
            </Form>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-marketing-flags:update"
              />
              <Button
                type="submit"
                variant="outlined"
                startIcon={<VisibilityOffRounded />}
                disabled={!canManage || enabledCount === 0}
              >
                Hide all public links
              </Button>
            </Form>
          </Stack>
          <MarketingLaunchFlagsForm
            admin={admin}
            platformSettings={platformSettings}
            roles={roles}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
