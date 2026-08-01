import { Form, useNavigation } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import MailRounded from "@mui/icons-material/MailRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import TextField from "../../components/form-text-field";
import { AdminRoleDefinition } from "../shared/types";

// Two ways to add an operator.
//
// Inviting is the default and the one to reach for: the person sets their own
// password from a one-time link, so a working credential never travels through
// a chat message or a phone call, and nobody has to remember to change it
// afterwards. The link expires in 48 hours and works once.
//
// Setting a password directly is kept for the case the invite cannot reach
// them — a wrong address, or an operator who needs access in the next minute.
export function AdminOperatorCreateForm({
  roles,
}: {
  roles: AdminRoleDefinition[];
}) {
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const roleField = (
    <TextField name="role" label="Role" select required defaultValue="support">
      {roles.map((role) => (
        <MenuItem key={role.role} value={role.role}>
          {role.label}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <>
      <Tabs
        value={mode}
        onChange={(_, next: "invite" | "password") => setMode(next)}
        sx={{ mb: 2 }}
      >
        <Tab value="invite" label="Send an invite" />
        <Tab value="password" label="Set a password" />
      </Tabs>

      {mode === "invite" ? (
        // Keyed so switching tabs gives a genuinely fresh form rather than
        // carrying a half-typed password across from the other mode.
        <Form method="post" key="invite">
          <input type="hidden" name="intent" value="admin-user:invite" />
          <Stack spacing={1.5}>
            <Alert severity="info" icon={<MailRounded fontSize="small" />}>
              They set their own password from a one-time link. It expires in 48
              hours, and nobody else ever sees it.
            </Alert>
            <TextField name="display_name" label="Display name" required />
            <TextField name="email" label="Email" type="email" required />
            <TextField
              name="phone"
              label="Phone (optional)"
              type="tel"
              placeholder="+233 20 000 0000"
              helperText="Given a number, the link is texted as well — email can sit unread."
            />
            {roleField}
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={<MailRounded />}
            >
              {submitting ? "Sending invite…" : "Send invite"}
            </Button>
          </Stack>
        </Form>
      ) : (
        <Form method="post" key="password">
          <input type="hidden" name="intent" value="admin-user:create" />
          <Stack spacing={1.5}>
            <Alert severity="warning">
              You will have to pass this password to them yourself. Prefer an
              invite unless you cannot reach their inbox.
            </Alert>
            <TextField name="display_name" label="Display name" required />
            <TextField name="email" label="Email" type="email" required />
            {roleField}
            {/* Toggleable: whoever creates an operator has to read the password
                back to them, so typing it blind is how a typo becomes a
                support ticket. */}
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
              disabled={submitting}
              startIcon={<PersonSearchRounded />}
            >
              {submitting ? "Creating…" : "Create operator"}
            </Button>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              They can change it once signed in.
            </Typography>
          </Stack>
        </Form>
      )}
    </>
  );
}
