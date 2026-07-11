import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import { tokens } from "../../../theme";
import {
  AdminPermissionDefinition,
  AdminRoleDefinition,
} from "../../shared/types";
import {
  isProtectedOwnerPermission,
  permissionDescription,
  roleHasPermission,
  roleTone,
} from "../utils";

export function PermissionMatrix({
  editRole,
  permissions,
  onClose,
}: {
  editRole: AdminRoleDefinition;
  permissions: AdminPermissionDefinition[];
  onClose: () => void;
}) {
  return (
    <Form key={editRole.role} method="post">
      <input
        type="hidden"
        name="intent"
        value="admin-role-permissions:update"
      />
      <input type="hidden" name="role" value={editRole.role} />
      <Stack spacing={2}>
        <Stack spacing={1}>
          {permissions.map((permission) => {
            const protectedPermission = isProtectedOwnerPermission(
              editRole.role,
              permission.permission,
            );
            const checked =
              roleHasPermission(editRole, permission.permission) ||
              protectedPermission;

            return (
              <Box
                key={permission.permission}
                sx={{
                  p: 1.25,
                  borderRadius: 1.25,
                  border: "1px solid",
                  borderColor: checked
                    ? alpha(roleTone(editRole.role), 0.26)
                    : alpha(tokens.ink, 0.08),
                  bgcolor: checked
                    ? alpha(roleTone(editRole.role), 0.055)
                    : alpha(tokens.white, 0.54),
                }}
              >
                {protectedPermission ? (
                  <input
                    type="hidden"
                    name="permissions"
                    value={permission.permission}
                  />
                ) : null}
                <FormControlLabel
                  sx={{
                    m: 0,
                    alignItems: "flex-start",
                    ".MuiFormControlLabel-label": { width: "100%" },
                  }}
                  control={
                    <Checkbox
                      name="permissions"
                      value={permission.permission}
                      defaultChecked={checked}
                      disabled={protectedPermission}
                      sx={{ pt: 0.2 }}
                    />
                  }
                  label={
                    <Box>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          {permission.label}
                        </Typography>
                        {protectedPermission ? (
                          <Chip
                            size="small"
                            label="Required"
                            sx={{
                              height: 22,
                              bgcolor: alpha(tokens.burgundy, 0.1),
                              color: tokens.burgundy,
                              fontWeight: 900,
                            }}
                          />
                        ) : null}
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {permissionDescription(permission.permission)}
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            );
          })}
        </Stack>

        {editRole.role === "owner" ? (
          <Alert severity="info">
            Owner recovery permissions are locked so the platform can
            always manage roles and operator access.
          </Alert>
        ) : null}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "flex-end" }}
        >
          <Button
            type="button"
            variant="outlined"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<AdminPanelSettingsRounded />}
          >
            Save permissions
          </Button>
        </Stack>
      </Stack>
    </Form>
  );
}
