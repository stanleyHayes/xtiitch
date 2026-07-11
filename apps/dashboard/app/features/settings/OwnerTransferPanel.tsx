import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { BusinessUser, CurrentUser } from "../shared/types";

export function OwnerTransferPanel({
  users,
  currentUser,
}: {
  users: BusinessUser[];
  currentUser: CurrentUser;
}) {
  const isOwner = currentUser.role === "owner";
  const activeAdmins = users.filter(
    (user) =>
      user.role === "admin" &&
      user.is_active &&
      user.business_user_id !== currentUser.user_id,
  );
  const disabled = !isOwner || activeAdmins.length === 0;
  const helper = !isOwner
    ? "Only the current owner can transfer ownership."
    : activeAdmins.length === 0
      ? "Create an active admin account before transferring ownership."
      : "Transfers demote the current owner to admin and require everyone involved to sign in again.";

  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.25 },
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.22),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.74)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.06)}, transparent 52%)`,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ color: "primary.main" }}>
          <VerifiedUserRounded />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>Owner transfer</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {helper}
          </Typography>
        </Box>
      </Stack>

      {!isOwner || activeAdmins.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {helper}
        </Alert>
      ) : null}

      <Form method="post">
        <input type="hidden" name="intent" value="transfer_owner" />
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <TextField
            name="new_owner_user_id"
            label="New owner"
            select
            size="small"
            defaultValue={activeAdmins[0]?.business_user_id ?? ""}
            disabled={disabled}
            required
            fullWidth
          >
            {activeAdmins.length === 0 ? (
              <MenuItem value="">No active admins available</MenuItem>
            ) : (
              activeAdmins.map((user) => (
                <MenuItem
                  key={user.business_user_id}
                  value={user.business_user_id}
                >
                  {user.display_name || user.email}
                </MenuItem>
              ))
            )}
          </TextField>
          <TextField
            name="confirmation"
            label='Type "TRANSFER OWNER"'
            size="small"
            disabled={disabled}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="outlined"
            color="error"
            startIcon={<VerifiedUserRounded />}
            disabled={disabled}
          >
            Transfer ownership
          </Button>
        </Stack>
      </Form>
    </Box>
  );
}