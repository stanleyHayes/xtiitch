import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import TextField from "../../components/form-text-field";
import type { AdminBusiness } from "../../lib/api";

export function BusinessAccountControlsDrawer({
  business,
  open,
  onClose,
  onDelete,
}: {
  business: AdminBusiness;
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const suspended = business.operationalStatus === "suspended";

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ backdrop: { sx: { backdropFilter: "blur(3px)" } } }}
    >
      <Box
        role="dialog"
        aria-label={`Manage ${business.name}`}
        sx={{
          width: { xs: "100vw", sm: 460 },
          maxWidth: "100vw",
          minHeight: "100%",
          p: { xs: 2.25, sm: 3 },
          bgcolor: "background.paper",
        }}
      >
        <Stack spacing={3}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "primary.main", fontWeight: 900, letterSpacing: ".1em" }}
              >
                Account management
              </Typography>
              <Typography variant="h4" component="h2" sx={{ mt: 0.25 }}>
                {business.name}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
                Sensitive changes are logged in the audit trail.
              </Typography>
            </Box>
            <IconButton aria-label="Close account management" onClick={onClose}>
              <CloseRounded />
            </IconButton>
          </Stack>

          <Divider />

          <Box component="section">
            <Typography variant="h6">
              {suspended ? "Restore business access" : "Pause business access"}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
              {suspended
                ? "Reactivate this tenant after completing your review."
                : "Suspension prevents the tenant from operating until an admin reactivates it."}
            </Typography>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-business-status:update"
              />
              <input type="hidden" name="business_id" value={business.id} />
              <input
                type="hidden"
                name="operational_status"
                value={suspended ? "active" : "suspended"}
              />
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {!suspended ? (
                  <TextField
                    name="reason"
                    label="Suspension reason"
                    placeholder="Explain why this tenant should be paused"
                    multiline
                    minRows={4}
                    fullWidth
                  />
                ) : (
                  <input
                    type="hidden"
                    name="reason"
                    value="Operator reactivated tenant activity after review."
                  />
                )}
                <Button
                  type="submit"
                  variant="contained"
                  color={suspended ? "primary" : "error"}
                  startIcon={
                    suspended ? <CheckCircleRounded /> : <BlockRounded />
                  }
                  fullWidth
                  sx={{ minHeight: 48 }}
                >
                  {suspended ? "Reactivate business" : "Suspend business"}
                </Button>
              </Stack>
            </Form>
          </Box>

          <Divider />

          <Box component="section">
            <Alert severity="error" variant="outlined">
              Deleting a business permanently removes its tenant-owned data.
            </Alert>
            <Button
              color="error"
              startIcon={<DeleteForeverRounded />}
              onClick={onDelete}
              sx={{ mt: 1.5, px: 0.5 }}
            >
              Delete business
            </Button>
          </Box>
        </Stack>
      </Box>
    </Drawer>
  );
}
