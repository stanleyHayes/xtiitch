import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import AddRounded from "@mui/icons-material/AddRounded";
import TextField from "../../components/form-text-field";
import { businessUserRoleOptions } from "../shared/constants";

export function BusinessUserCreateForm({ error }: { error?: string }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="create_business_user" />
      <Stack spacing={1.5}>
        {error ? <Alert severity="warning">{error}</Alert> : null}
        <TextField
          name="display_name"
          label="Name"
          size="small"
          required
          fullWidth
        />
        <TextField
          name="phone"
          label="Phone (for SMS alerts)"
          helperText="Used for order + account SMS notifications."
          size="small"
          fullWidth
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          size="small"
          required
          fullWidth
        />
        <TextField
          name="password"
          label="Temporary password"
          type="password"
          size="small"
          required
          fullWidth
          slotProps={{ htmlInput: { minLength: 8, maxLength: 72 } }}
        />
        <TextField
          name="role"
          label="Role"
          select
          defaultValue="staff"
          size="small"
        >
          {businessUserRoleOptions.map((role) => (
            <MenuItem key={role.value} value={role.value}>
              {role.label}
            </MenuItem>
          ))}
        </TextField>
        <Button type="submit" variant="contained" startIcon={<AddRounded />}>
          Add team member
        </Button>
      </Stack>
    </Form>
  );
}