import { Form, redirect } from "react-router";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import type { Route } from "./+types/dashboard";
import { apiFetch, logOut } from "../lib/auth";
import type { Design } from "../lib/api";

type Profile = { name: string; handle: string; verification_status: string; plan: string };

export function meta(): Route.MetaDescriptors {
  return [{ title: "Dashboard · Xtiitch" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const profile = (await (await apiFetch(request, "/businesses/me")).json()) as Profile;
  const designsData = (await (await apiFetch(request, "/designs")).json()) as { designs: Design[] };
  return { profile, designs: designsData.designs ?? [] };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "logout") {
    return logOut(request);
  }

  if (intent === "create") {
    const imageUrl = String(form.get("image_url") ?? "").trim();
    const response = await apiFetch(request, "/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        customisation_allowed: form.get("customisation") === "on",
        images: imageUrl ? [imageUrl] : [],
      }),
    });
    if (!response.ok) {
      return { error: "Could not create the design — a title is required." };
    }
    return redirect("/dashboard");
  }

  if (intent === "retire" || intent === "restore") {
    await apiFetch(request, `/designs/${String(form.get("id") ?? "")}/${intent}`, { method: "POST" });
    return redirect("/dashboard");
  }

  return null;
}

function DesignRow({ design }: { design: Design }) {
  const retired = design.status === "retired";
  return (
    <Card>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          aria-hidden
          sx={{
            width: 56,
            height: 70,
            flexShrink: 0,
            borderRadius: 1.5,
            overflow: "hidden",
            bgcolor: "rgba(128,0,32,0.08)",
            color: "primary.main",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
          }}
        >
          {design.images[0] ? (
            <Box component="img" src={design.images[0]} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            design.title.slice(0, 1).toUpperCase()
          )}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {design.title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: "center" }}>
            <Chip size="small" color={retired ? "default" : "success"} label={design.status} />
            {design.customisation_allowed ? <Chip size="small" variant="outlined" label="Customisable" /> : null}
          </Stack>
        </Box>
        <Form method="post">
          <input type="hidden" name="id" value={design.design_id} />
          <input type="hidden" name="intent" value={retired ? "restore" : "retire"} />
          <Button type="submit" size="small" variant="outlined" color={retired ? "primary" : "inherit"}>
            {retired ? "Restore" : "Retire"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function Dashboard({ loaderData, actionData }: Route.ComponentProps) {
  const { profile, designs } = loaderData;
  const verified = profile.verification_status === "verified";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="secondary" elevation={0}>
        <Container>
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {profile.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                /store/{profile.handle} · {profile.plan} plan
              </Typography>
            </Box>
            <Chip
              size="small"
              color={verified ? "success" : "warning"}
              label={verified ? "Verified" : "Unverified"}
            />
            <Link href={`/store/${profile.handle}`} target="_blank" sx={{ color: "common.white" }} underline="hover">
              View store
            </Link>
            <Form method="post">
              <input type="hidden" name="intent" value="logout" />
              <Button type="submit" size="small" sx={{ color: "common.white" }}>
                Log out
              </Button>
            </Form>
          </Toolbar>
        </Container>
      </AppBar>

      <Container sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "grid", gap: 4, gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, alignItems: "start" }}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Add a design
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="create" />
              <Stack spacing={2}>
                {actionData?.error ? <Alert severity="error">{actionData.error}</Alert> : null}
                <TextField name="title" label="Title" required fullWidth size="small" />
                <TextField name="description" label="Description" fullWidth size="small" multiline minRows={2} />
                <TextField name="image_url" label="Image URL" fullWidth size="small" placeholder="https://…" />
                <FormControlLabel control={<Checkbox name="customisation" />} label="Allow customisation" />
                <Button type="submit" variant="contained">
                  Add design
                </Button>
              </Stack>
            </Form>
          </Paper>

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Your designs ({designs.length})
            </Typography>
            {designs.length === 0 ? (
              <Typography sx={{ color: "text.secondary" }}>
                No designs yet. Add your first one to start building your store.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {designs.map((design) => (
                  <DesignRow key={design.design_id} design={design} />
                ))}
              </Stack>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
