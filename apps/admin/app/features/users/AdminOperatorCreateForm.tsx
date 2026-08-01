import { Form } from "react-router";
import { useState } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import TextField from "../../components/form-text-field";
import { AdminRoleDefinition } from "../shared/types";

export function AdminOperatorCreateForm({ roles }: { roles: AdminRoleDefinition[] }) {
  const [showPassword, setShowPassword] = useState(false);
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
        {/* Toggleable like the sign-in field. Whoever creates an operator has
            to read this password back to them, so typing it blind is how a
            typo becomes a support ticket. */}
        <TextField
          name="password"
          label="Temporary password"
          type={showPassword ? "text" : "password"}
          required
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                    edge="end"
                  >
                    {showPassword ? (
                      <VisibilityOffRounded />
                    ) : (
                      <VisibilityRounded />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
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
