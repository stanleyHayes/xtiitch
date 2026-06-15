import { Form, redirect } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import type { Route } from "./+types/login";
import { API_BASE } from "../lib/auth";
import { commitSession, getSession } from "../lib/session";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Sign in · Xtiitch" }, { name: "robots", content: "noindex" }];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const response = await fetch(`${API_BASE}/v1/auth/business/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ business_handle: handle, owner_email: email, owner_password: password }),
  });
  if (!response.ok) {
    return { error: "Those details didn't match. Check your store handle, email and password." };
  }

  const data = (await response.json()) as { access_token: string; refresh_token: string };
  const session = await getSession(request.headers.get("Cookie"));
  session.set("access", data.access_token);
  session.set("refresh", data.refresh_token);

  return redirect("/dashboard", { headers: { "Set-Cookie": await commitSession(session) } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default" }}>
      <Container sx={{ maxWidth: 420 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="h4" component="h1">
            Xtiitch dashboard
          </Typography>
          <Typography sx={{ mt: 1, color: "text.secondary" }}>
            Sign in to run your store.
          </Typography>
        </Box>
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Form method="post">
            <Stack spacing={2.5}>
              {actionData?.error ? <Alert severity="error">{actionData.error}</Alert> : null}
              <TextField name="handle" label="Store handle" required autoComplete="username" fullWidth />
              <TextField name="email" label="Email" type="email" required autoComplete="email" fullWidth />
              <TextField name="password" label="Password" type="password" required autoComplete="current-password" fullWidth />
              <Button type="submit" variant="contained" size="large">
                Sign in
              </Button>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </Box>
  );
}
