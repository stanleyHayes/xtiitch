import { Form } from "react-router";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import TextField from "../../components/form-text-field";
import { AdminRoleDefinition } from "../shared/types";



export function AdminOperatorCreateForm({ roles }: { roles: AdminRoleDefinition[] }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-user:create" />
      <Stack spacing={1.5}>
        <TextField name="display_name" label="Display name" required />
        <TextField name="email" label="Email" type="email" required />
        <TextField
          name="role"
          label="Role"
          select
          required
          defaultValue="support"
        >
          {roles.map((role) => (
            <MenuItem key={role.role} value={role.role}>
              {role.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="password"
          label="Temporary password"
          type="password"
          required
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={<PersonSearchRounded />}
        >
          Create operator
        </Button>
      </Stack>
    </Form>
  );
}
