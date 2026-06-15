import { Form, Link as RouterLink, redirect } from "react-router";
import type { ReactNode } from "react";
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
import MuiLink from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import MailRounded from "@mui/icons-material/MailRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { Route } from "./+types/dashboard";
import { apiFetch, logOut } from "../lib/auth";
import type { Design } from "../lib/api";
import { formatGHS } from "../lib/format";
import { tokens } from "../theme";

type Profile = { name: string; handle: string; verification_status: string; plan: string };

type OrderSummary = {
  order_id: string;
  design_title: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  order_type: string;
  size_mode: string;
  channel: string;
  stage_name: string;
  colour: string;
  agreed_total_minor: number | null;
  settled_minor: number;
  payment_status: string;
  payment_purpose: string;
  payment_amount_minor: number | null;
  created_at: string;
};

type OrderFilter = "all" | "standard" | "custom" | "draft" | "confirmed" | "fulfilled";

const orderFilters: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
  { value: "draft", label: "Awaiting pay" },
  { value: "confirmed", label: "In studio" },
  { value: "fulfilled", label: "Fulfilled" },
];

export function meta(): Route.MetaDescriptors {
  return [{ title: "Dashboard · Xtiitch" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const orderFilter = parseOrderFilter(url.searchParams.get("orders"));
  const [profileResponse, designsResponse, ordersResponse] = await Promise.all([
    apiFetch(request, "/businesses/me"),
    apiFetch(request, "/designs"),
    apiFetch(request, "/orders"),
  ]);
  const profile = (await profileResponse.json()) as Profile;
  const designsData = (await designsResponse.json()) as { designs: Design[] };
  const ordersData = (await ordersResponse.json()) as { orders: OrderSummary[] };
  return {
    profile,
    designs: designsData.designs ?? [],
    orders: ordersData.orders ?? [],
    orderFilter,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "logout") {
    return logOut(request);
  }

  if (intent === "advance") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID) {
      return { orderError: "That order cannot move stages yet." };
    }
    const response = await apiFetch(request, `/orders/${encodeURIComponent(orderID)}/advance`, { method: "POST" });
    if (!response.ok) {
      return { orderError: "That order cannot move stages yet." };
    }
    return redirect(returnTo);
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
      return { designError: "Could not create the design. A title is required." };
    }
    return redirect("/dashboard");
  }

  if (intent === "retire" || intent === "restore") {
    await apiFetch(request, `/designs/${String(form.get("id") ?? "")}/${intent}`, { method: "POST" });
    return redirect("/dashboard");
  }

  return null;
}

function parseOrderFilter(value: string | null): OrderFilter {
  return orderFilters.some((filter) => filter.value === value) ? (value as OrderFilter) : "all";
}

function safeDashboardReturn(value: string): string {
  return value === "/dashboard" || value.startsWith("/dashboard?") || value.startsWith("/dashboard#")
    ? value
    : "/dashboard?orders=all#orders";
}

function filterOrders(orders: OrderSummary[], filter: OrderFilter): OrderSummary[] {
  if (filter === "all") {
    return orders;
  }
  if (filter === "standard" || filter === "custom") {
    return orders.filter((order) => order.order_type === filter);
  }
  return orders.filter((order) => order.status === filter);
}

function countOrders(orders: OrderSummary[], filter: OrderFilter): number {
  return filterOrders(orders, filter).length;
}

function stageColor(colour: string): string {
  switch (colour) {
    case "green":
      return tokens.success;
    case "yellow":
      return tokens.warning;
    default:
      return tokens.burgundy;
  }
}

function orderRouteLabel(order: OrderSummary): string {
  switch (order.size_mode) {
    case "self_measure":
      return "Self-measure";
    case "home_visit":
      return "Home visit";
    case "come_to_shop":
      return "Come to shop";
    default:
      return "Size band";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Awaiting payment";
    case "confirmed":
      return "In studio";
    case "fulfilled":
      return "Fulfilled";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function paymentLabel(order: OrderSummary): string {
  if (order.payment_status === "none") {
    return order.channel === "walk_in" || order.size_mode === "come_to_shop" ? "Offline arrangement" : "No payment";
  }
  switch (order.payment_status) {
    case "succeeded":
      return order.payment_purpose === "deposit" ? "Deposit paid" : "Paid";
    case "initiated":
      return "Payment pending";
    case "failed":
      return "Payment failed";
    case "reversed":
      return "Reversed";
    default:
      return order.payment_status;
  }
}

function moneyProgress(order: OrderSummary): string {
  const target = order.agreed_total_minor ?? order.payment_amount_minor;
  if (!target) {
    return order.settled_minor > 0 ? formatGHS(order.settled_minor) : "No total set";
  }
  return `${formatGHS(order.settled_minor)} / ${formatGHS(target)}`;
}

function shortDate(value: string): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GH", { month: "short", day: "numeric" }).format(new Date(value));
}

function MetricCard({
  icon,
  label,
  value,
  tone = tokens.burgundy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(tone, 0.1),
            color: tone,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 24, lineHeight: 1 }}>{value}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {label}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function OrderCard({ order, returnTo }: { order: OrderSummary; returnTo: string }) {
  const colour = stageColor(order.colour);
  const canAdvance = order.status === "confirmed";

  return (
    <Card id={`order-${order.order_id}`}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 220px" },
            alignItems: "start",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
              <Chip size="small" label={order.order_type === "custom" ? "Custom" : "Standard"} color="primary" />
              <Chip size="small" variant="outlined" label={order.channel === "walk_in" ? "Walk-in" : "Online"} />
              <Chip size="small" variant="outlined" label={orderRouteLabel(order)} />
            </Stack>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              {order.design_title}
            </Typography>
            <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
              {order.customer_name} {shortDate(order.created_at) ? `· ${shortDate(order.created_at)}` : ""}
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1.5, color: "text.secondary" }}>
              {order.customer_phone ? (
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <PhoneRounded sx={{ fontSize: 17 }} />
                  <Typography variant="body2">{order.customer_phone}</Typography>
                </Stack>
              ) : null}
              {order.customer_email ? (
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <MailRounded sx={{ fontSize: 17 }} />
                  <Typography variant="body2">{order.customer_email}</Typography>
                </Stack>
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              border: "1px solid",
              borderColor: alpha(colour, 0.35),
              borderRadius: 2,
              p: 1.5,
              bgcolor: alpha(colour, 0.08),
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colour }} />
              <Typography sx={{ fontWeight: 700 }}>{order.stage_name || statusLabel(order.status)}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
              {statusLabel(order.status)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <PaymentsRounded sx={{ color: "primary.main" }} />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{paymentLabel(order)}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {moneyProgress(order)}
              </Typography>
            </Box>
          </Stack>
          <Form method="post">
            <input type="hidden" name="intent" value="advance" />
            <input type="hidden" name="order_id" value={order.order_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <Button
              type="submit"
              variant={canAdvance ? "contained" : "outlined"}
              disabled={!canAdvance}
              endIcon={<ArrowForwardRounded />}
            >
              {canAdvance ? "Advance stage" : statusLabel(order.status)}
            </Button>
          </Form>
        </Stack>
      </CardContent>
    </Card>
  );
}

function DesignRow({ design }: { design: Design }) {
  const retired = design.status === "retired";
  return (
    <Card>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2 }}>
        <Box
          aria-hidden
          sx={{
            width: 48,
            height: 60,
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
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {design.title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: "center", flexWrap: "wrap" }}>
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
  const { profile, designs, orders, orderFilter } = loaderData;
  const orderError = actionData && "orderError" in actionData ? actionData.orderError : undefined;
  const designError = actionData && "designError" in actionData ? actionData.designError : undefined;
  const verified = profile.verification_status === "verified";
  const filteredOrders = filterOrders(orders, orderFilter);
  const returnTo = `/dashboard?orders=${orderFilter}#orders`;
  const liveOrders = orders.filter((order) => order.status !== "fulfilled" && order.status !== "cancelled");
  const paidMinor = orders.reduce((sum, order) => sum + order.settled_minor, 0);
  const customCount = orders.filter((order) => order.order_type === "custom").length;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="secondary" elevation={0}>
        <Container>
          <Toolbar disableGutters sx={{ gap: 2, minHeight: 72 }}>
            <StorefrontRounded sx={{ color: "primary.light" }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }} noWrap>
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
            <MuiLink href={`/store/${profile.handle}`} target="_blank" sx={{ color: "common.white" }} underline="hover">
              View store
            </MuiLink>
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
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1">
            Studio dashboard
          </Typography>
          <Typography sx={{ mt: 0.75, color: "text.secondary", maxWidth: 720 }}>
            Orders, payments, customer contact, and production stages for the storefront.
          </Typography>
        </Box>

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
          <MetricCard icon={<ReceiptLongRounded />} label="Live orders" value={String(liveOrders.length)} />
          <MetricCard icon={<RadioButtonUncheckedRounded />} label="Awaiting payment" value={String(countOrders(orders, "draft"))} tone={tokens.warning} />
          <MetricCard icon={<PaymentsRounded />} label="Settled through Xtiitch" value={formatGHS(paidMinor)} tone={tokens.success} />
          <MetricCard icon={<Inventory2Rounded />} label="Custom orders" value={String(customCount)} tone={tokens.info} />
        </Box>

        <Box
          sx={{
            mt: 4,
            display: "grid",
            gap: { xs: 3, lg: 4 },
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.45fr) minmax(320px, 0.55fr)" },
            alignItems: "start",
          }}
        >
          <Box id="orders">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="h5">Orders board</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {filteredOrders.length} of {orders.length} orders
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {orderFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    component={RouterLink}
                    to={`/dashboard?orders=${filter.value}#orders`}
                    size="small"
                    variant={orderFilter === filter.value ? "contained" : "outlined"}
                  >
                    {filter.label} ({countOrders(orders, filter.value)})
                  </Button>
                ))}
              </Stack>
            </Stack>

            {orderError ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {orderError}
              </Alert>
            ) : null}

            {filteredOrders.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  textAlign: "center",
                }}
              >
                <CheckCircleRounded sx={{ color: "success.main", fontSize: 40 }} />
                <Typography sx={{ mt: 1, fontWeight: 700 }}>No orders in this view</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
                  New checkout and walk-in orders will appear here.
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {filteredOrders.map((order) => (
                  <OrderCard key={order.order_id} order={order} returnTo={returnTo} />
                ))}
              </Stack>
            )}
          </Box>

          <Box>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Add a design
              </Typography>
              <Form method="post">
                <input type="hidden" name="intent" value="create" />
                <Stack spacing={2}>
                  {designError ? <Alert severity="error">{designError}</Alert> : null}
                  <TextField name="title" label="Title" required fullWidth size="small" />
                  <TextField name="description" label="Description" fullWidth size="small" multiline minRows={2} />
                  <TextField name="image_url" label="Image URL" fullWidth size="small" placeholder="https://..." />
                  <FormControlLabel control={<Checkbox name="customisation" />} label="Allow customisation" />
                  <Button type="submit" variant="contained">
                    Add design
                  </Button>
                </Stack>
              </Form>
            </Paper>

            <Box sx={{ mt: 3 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 2 }}>
                <Typography variant="h6">Designs</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {designs.length}
                </Typography>
              </Stack>
              {designs.length === 0 ? (
                <Typography sx={{ color: "text.secondary" }}>No designs yet.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {designs.map((design) => (
                    <DesignRow key={design.design_id} design={design} />
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
