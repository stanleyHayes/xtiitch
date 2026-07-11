import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "../../components/form-text-field";
import { AdminUser, AdminRoleDefinition } from "../shared/types";
import { DetailLine } from "../shared/DetailLine";



export function AdminOperatorDetailForm({
  user,
  roles,
  currentUserId,
}: {
  user: AdminUser;
  roles: AdminRoleDefinition[];
  currentUserId: string;
}) {
  const isSelf = user.adminUserId === currentUserId;

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-user:update" />
      <input type="hidden" name="admin_user_id" value={user.adminUserId} />
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          }}
        >
          <DetailLine label="Email" value={user.email} />
          <DetailLine label="Current role" value={user.role} />
          <DetailLine
            label="Access state"
            value={user.isActive ? "Active" : "Inactive"}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              md: "1.35fr 0.85fr 0.75fr auto",
            },
            alignItems: "end",
          }}
        >
          <TextField
            name="display_name"
            label="Display name"
            defaultValue={user.displayName}
            required
          />
          <TextField
            name="role"
            label="Role"
            select
            defaultValue={user.role}
            required
          >
            {roles.map((role) => (
              <MenuItem key={role.role} value={role.role}>
                {role.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="is_active"
            label="Status"
            select
            defaultValue={String(user.isActive)}
            required
          >
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Inactive</MenuItem>
          </TextField>
          <Button
            type="submit"
            variant={isSelf ? "outlined" : "contained"}
            disabled={isSelf && user.role === "owner"}
            sx={{ minHeight: 56 }}
          >
            Save
          </Button>
        </Box>
        {isSelf && user.role === "owner" ? (
          <Alert severity="info">
            Self-demotion and self-deactivation are blocked to avoid locking the
            platform out.
          </Alert>
        ) : null}
      </Stack>
    </Form>
  );
}
