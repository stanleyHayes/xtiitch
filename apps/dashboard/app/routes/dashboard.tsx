import { Form, Link as RouterLink, redirect } from "react-router";
import type { ReactElement, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import type { Route } from "./+types/dashboard";
import { apiFetch, logOut } from "../lib/auth";
import type { Design } from "../lib/api";
import { formatGHS } from "../lib/format";
import { tokens } from "../theme";

type Profile = {
  name: string;
  handle: string;
  verification_status: string;
  plan: string;
};

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

type MeasurementField = {
  field_id: string;
  label: string;
  unit: "cm" | "in";
  sequence: number;
  created_at: string;
  updated_at: string;
};

type OrderFilter =
  | "all"
  | "standard"
  | "custom"
  | "draft"
  | "confirmed"
  | "fulfilled";

type DashboardActionData = {
  orderError?: string;
  designError?: string;
  fieldError?: string;
  measurementError?: string;
};

const orderFilters: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
  { value: "draft", label: "Awaiting pay" },
  { value: "confirmed", label: "In studio" },
  { value: "fulfilled", label: "Fulfilled" },
];

const workspaceNav: { href: string; label: string; icon: ReactNode }[] = [
  { href: "#orders", label: "Orders", icon: <TimelineRounded /> },
  { href: "#catalogue", label: "Catalogue", icon: <DesignServicesRounded /> },
  { href: "#measurements", label: "Measurements", icon: <StraightenRounded /> },
];

const fieldUnits = [
  { value: "in", label: "in" },
  { value: "cm", label: "cm" },
];

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Dashboard · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const orderFilter = parseOrderFilter(url.searchParams.get("orders"));
  const [profileResponse, designsResponse, ordersResponse, fieldsResponse] =
    await Promise.all([
      apiFetch(request, "/businesses/me"),
      apiFetch(request, "/designs"),
      apiFetch(request, "/orders"),
      apiFetch(request, "/measurement-fields"),
    ]);
  const profile = (await profileResponse.json()) as Profile;
  const designsData = (await designsResponse.json()) as { designs: Design[] };
  const ordersData = (await ordersResponse.json()) as {
    orders: OrderSummary[];
  };
  const fieldsData = (await fieldsResponse.json()) as {
    fields: MeasurementField[];
  };
  return {
    profile,
    designs: designsData.designs ?? [],
    orders: ordersData.orders ?? [],
    measurementFields: fieldsData.fields ?? [],
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
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/advance`,
      { method: "POST" },
    );
    if (!response.ok) {
      return { orderError: "That order cannot move stages yet." };
    }
    return redirect(returnTo);
  }

  if (intent === "record_measurements") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const source = String(form.get("source") ?? "").trim();
    const values = extractMeasurementValues(form);
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID || !source || Object.keys(values).length === 0) {
      return {
        measurementError: "Add at least one measurement value before saving.",
      };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/measurements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, values }),
      },
    );
    if (!response.ok) {
      return {
        measurementError:
          "Could not save those measurements. Check the order route and field list.",
      };
    }
    return redirect(returnTo);
  }

  if (intent === "create_measurement_field") {
    const sequence = parseSequence(form.get("sequence"));
    if (sequence === null) {
      return {
        fieldError: "Use a zero or positive display order for the field.",
      };
    }
    const response = await apiFetch(request, "/measurement-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: String(form.get("label") ?? "").trim(),
        unit: String(form.get("unit") ?? "in").trim(),
        sequence,
      }),
    });
    if (!response.ok) {
      return {
        fieldError:
          "Could not add the field. Check the label and display order.",
      };
    }
    return redirect("/dashboard#measurements");
  }

  if (intent === "update_measurement_field") {
    const fieldID = String(form.get("field_id") ?? "").trim();
    const sequence = parseSequence(form.get("sequence"));
    if (!fieldID || sequence === null) {
      return {
        fieldError: "Could not update that field. Check the display order.",
      };
    }
    const response = await apiFetch(
      request,
      `/measurement-fields/${encodeURIComponent(fieldID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(form.get("label") ?? "").trim(),
          unit: String(form.get("unit") ?? "in").trim(),
          sequence,
        }),
      },
    );
    if (!response.ok) {
      return {
        fieldError:
          "Could not update that field. Another field may already use that order.",
      };
    }
    return redirect("/dashboard#measurements");
  }

  if (intent === "delete_measurement_field") {
    const fieldID = String(form.get("field_id") ?? "").trim();
    if (!fieldID) {
      return { fieldError: "Could not delete that field." };
    }
    const response = await apiFetch(
      request,
      `/measurement-fields/${encodeURIComponent(fieldID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return { fieldError: "Could not delete that field." };
    }
    return redirect("/dashboard#measurements");
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
      return {
        designError: "Could not create the design. A title is required.",
      };
    }
    return redirect("/dashboard#catalogue");
  }

  if (intent === "retire" || intent === "restore") {
    await apiFetch(
      request,
      `/designs/${String(form.get("id") ?? "")}/${intent}`,
      { method: "POST" },
    );
    return redirect("/dashboard#catalogue");
  }

  return null;
}

function parseOrderFilter(value: string | null): OrderFilter {
  return orderFilters.some((filter) => filter.value === value)
    ? (value as OrderFilter)
    : "all";
}

function safeDashboardReturn(value: string): string {
  return value === "/dashboard" ||
    value.startsWith("/dashboard?") ||
    value.startsWith("/dashboard#")
    ? value
    : "/dashboard?orders=all#orders";
}

function parseSequence(value: FormDataEntryValue | null): number | null {
  const sequence = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(sequence) && sequence >= 0 ? sequence : null;
}

function extractMeasurementValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("measurement_")) {
      continue;
    }
    const fieldID = key.slice("measurement_".length);
    const entered = String(value ?? "").trim();
    if (fieldID && entered) {
      values[fieldID] = entered;
    }
  }
  return values;
}

function filterOrders(
  orders: OrderSummary[],
  filter: OrderFilter,
): OrderSummary[] {
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

function measurementSourceFor(order: OrderSummary): "visit" | "shop" | null {
  if (order.order_type !== "custom" || order.status !== "confirmed") {
    return null;
  }
  if (order.size_mode === "home_visit") {
    return "visit";
  }
  if (order.size_mode === "come_to_shop") {
    return "shop";
  }
  return null;
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
    return order.channel === "walk_in" || order.size_mode === "come_to_shop"
      ? "Offline arrangement"
      : "No payment";
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

function paymentTone(order: OrderSummary): string {
  switch (order.payment_status) {
    case "succeeded":
      return tokens.success;
    case "initiated":
      return tokens.warning;
    case "failed":
    case "reversed":
      return tokens.danger;
    default:
      return tokens.info;
  }
}

function moneyProgress(order: OrderSummary): string {
  const target = order.agreed_total_minor ?? order.payment_amount_minor;
  if (!target) {
    return order.settled_minor > 0
      ? formatGHS(order.settled_minor)
      : "No total set";
  }
  return `${formatGHS(order.settled_minor)} / ${formatGHS(target)}`;
}

function shortDate(value: string): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function orderInitials(order: OrderSummary): string {
  return (order.customer_name || order.design_title || "Order")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function Panel({
  children,
  sx,
  id,
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
  id?: string;
}) {
  return (
    <Paper
      id={id}
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function SectionHeader({
  eyebrow,
  title,
  helper,
  action,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      sx={{
        justifyContent: "space-between",
        alignItems: { xs: "flex-start", md: "flex-end" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", fontWeight: 800 }}
        >
          {eyebrow}
        </Typography>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        <Typography sx={{ mt: 0.5, color: "text.secondary", maxWidth: 720 }}>
          {helper}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = tokens.burgundy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <Panel sx={{ p: 2.25, minHeight: 142 }}>
      <Stack
        spacing={2}
        sx={{ height: "100%", justifyContent: "space-between" }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 800 }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tone, 0.1),
              color: tone,
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Box>
          <Typography variant="h4" sx={{ lineHeight: 1.05 }}>
            {value}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.75, color: "text.secondary" }}
          >
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Panel>
  );
}

function ToneChip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: string;
  icon?: ReactElement;
}) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={{
        bgcolor: alpha(tone, 0.1),
        color: tone,
        border: "1px solid",
        borderColor: alpha(tone, 0.22),
        "& .MuiChip-icon": { color: tone },
      }}
    />
  );
}

function EmptyState({
  icon,
  title,
  helper,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <Panel
      sx={{ p: { xs: 3, md: 5 }, textAlign: "center", borderStyle: "dashed" }}
    >
      <Box sx={{ color: "primary.main", mb: 1 }}>{icon}</Box>
      <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      <Typography
        variant="body2"
        sx={{ mt: 0.5, color: "text.secondary", maxWidth: 420, mx: "auto" }}
      >
        {helper}
      </Typography>
    </Panel>
  );
}

function OrderCard({
  order,
  returnTo,
  measurementFields,
}: {
  order: OrderSummary;
  returnTo: string;
  measurementFields: MeasurementField[];
}) {
  const colour = stageColor(order.colour);
  const payTone = paymentTone(order);
  const canAdvance = order.status === "confirmed";
  const measurementSource = measurementSourceFor(order);
  const showMeasurementCapture = Boolean(measurementSource);

  return (
    <Panel id={`order-${order.order_id}`} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2.25}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                bgcolor: alpha(colour, 0.1),
                color: colour,
                fontWeight: 800,
              }}
            >
              {orderInitials(order)}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", mb: 0.75 }}
              >
                <ToneChip
                  label={order.order_type === "custom" ? "Custom" : "Standard"}
                  tone={tokens.burgundy}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={order.channel === "walk_in" ? "Walk-in" : "Online"}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={orderRouteLabel(order)}
                />
              </Stack>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                {order.design_title}
              </Typography>
              <Typography sx={{ mt: 0.65, color: "text.secondary" }}>
                {order.customer_name || "Unnamed customer"}{" "}
                {shortDate(order.created_at)
                  ? `· ${shortDate(order.created_at)}`
                  : ""}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              minWidth: { xs: "100%", md: 235 },
              border: "1px solid",
              borderColor: alpha(colour, 0.28),
              borderRadius: 2,
              p: 1.5,
              bgcolor: alpha(colour, 0.08),
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: colour,
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ fontWeight: 800 }}>
                {order.stage_name || statusLabel(order.status)}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 0.75, color: "text.secondary" }}
            >
              {statusLabel(order.status)}
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <InfoStrip
            icon={<PaymentsRounded />}
            tone={payTone}
            title={paymentLabel(order)}
            helper={moneyProgress(order)}
          />
          <InfoStrip
            icon={<PhoneRounded />}
            tone={tokens.info}
            title={order.customer_phone || "No phone captured"}
            helper={order.customer_email || "No email captured"}
          />
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Ref {order.order_id.slice(0, 8)}
          </Typography>
          <Form method="post">
            <input type="hidden" name="intent" value="advance" />
            <input type="hidden" name="order_id" value={order.order_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <Button
              type="submit"
              variant={canAdvance ? "contained" : "outlined"}
              disabled={!canAdvance}
              endIcon={<ArrowForwardRounded />}
              fullWidth
            >
              {canAdvance ? "Advance stage" : statusLabel(order.status)}
            </Button>
          </Form>
        </Stack>

        {showMeasurementCapture ? (
          <Box
            sx={{
              borderTop: "1px solid",
              borderColor: "divider",
              pt: 2,
            }}
          >
            {measurementFields.length === 0 ? (
              <Alert severity="info" icon={<StraightenRounded />}>
                Add measurement fields before recording this{" "}
                {orderRouteLabel(order).toLowerCase()} order.
              </Alert>
            ) : (
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="record_measurements"
                />
                <input type="hidden" name="order_id" value={order.order_id} />
                <input
                  type="hidden"
                  name="source"
                  value={measurementSource ?? ""}
                />
                <input
                  type="hidden"
                  name="return_to"
                  value={`/dashboard?orders=${order.order_type}#order-${order.order_id}`}
                />
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography sx={{ fontWeight: 800 }}>
                      {measurementSource === "visit"
                        ? "Visit measurements"
                        : "Shop measurements"}
                    </Typography>
                    <ToneChip
                      label={
                        measurementSource === "visit"
                          ? "Home visit"
                          : "Come to shop"
                      }
                      tone={tokens.info}
                    />
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.25,
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                      },
                    }}
                  >
                    {measurementFields.map((field) => (
                      <TextField
                        key={field.field_id}
                        name={`measurement_${field.field_id}`}
                        label={`${field.label} (${field.unit})`}
                        size="small"
                        slotProps={{ htmlInput: { inputMode: "decimal" } }}
                      />
                    ))}
                  </Box>
                  <Button
                    type="submit"
                    variant="outlined"
                    startIcon={<SaveRounded />}
                    sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
                  >
                    Save measurements
                  </Button>
                </Stack>
              </Form>
            )}
          </Box>
        ) : null}
      </Stack>
    </Panel>
  );
}

function InfoStrip({
  icon,
  tone,
  title,
  helper,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  helper: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        p: 1.35,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(tone, 0.18),
        bgcolor: alpha(tone, 0.055),
        minWidth: 0,
      }}
    >
      <Box sx={{ color: tone, pt: 0.15 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
        >
          {helper}
        </Typography>
      </Box>
    </Stack>
  );
}

function DesignRow({ design }: { design: Design }) {
  const retired = design.status === "retired";
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "64px minmax(0, 1fr)",
          sm: "72px minmax(0, 1fr) auto",
        },
        alignItems: "center",
        py: 1.5,
        px: { xs: 2, md: 2.5 },
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 58,
          height: 74,
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: alpha(tokens.burgundy, 0.08),
          color: "primary.main",
          display: "grid",
          placeItems: "center",
        }}
      >
        {design.images[0] ? (
          <Box
            component="img"
            src={design.images[0]}
            alt=""
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <DesignServicesRounded />
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800 }} noWrap>
          {design.title}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
          {design.description || "No description yet"}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 0.85, alignItems: "center", flexWrap: "wrap" }}
        >
          <ToneChip
            label={design.status}
            tone={retired ? tokens.mutedText : tokens.success}
          />
          {design.customisation_allowed ? (
            <Chip size="small" variant="outlined" label="Customisable" />
          ) : null}
        </Stack>
      </Box>
      <Form method="post">
        <input type="hidden" name="id" value={design.design_id} />
        <input
          type="hidden"
          name="intent"
          value={retired ? "restore" : "retire"}
        />
        <Button
          type="submit"
          size="small"
          variant="outlined"
          color={retired ? "primary" : "inherit"}
          fullWidth
        >
          {retired ? "Restore" : "Retire"}
        </Button>
      </Form>
    </Box>
  );
}

function MeasurementFieldRow({ field }: { field: MeasurementField }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1fr) 96px 110px auto",
        },
        alignItems: "center",
        py: 1.5,
        px: { xs: 2, md: 2.5 },
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Form method="post" style={{ display: "contents" }}>
        <input type="hidden" name="intent" value="update_measurement_field" />
        <input type="hidden" name="field_id" value={field.field_id} />
        <TextField
          name="label"
          label="Field"
          defaultValue={field.label}
          size="small"
          required
        />
        <TextField
          name="unit"
          label="Unit"
          select
          defaultValue={field.unit}
          size="small"
        >
          {fieldUnits.map((unit) => (
            <MenuItem key={unit.value} value={unit.value}>
              {unit.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="sequence"
          label="Order"
          type="number"
          defaultValue={field.sequence}
          size="small"
          slotProps={{ htmlInput: { min: 0 } }}
          required
        />
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}
        >
          <Tooltip title="Save field">
            <IconButton
              type="submit"
              color="primary"
              aria-label={`Save ${field.label}`}
            >
              <SaveRounded />
            </IconButton>
          </Tooltip>
        </Stack>
      </Form>
      <Form method="post">
        <input type="hidden" name="intent" value="delete_measurement_field" />
        <input type="hidden" name="field_id" value={field.field_id} />
        <Tooltip title="Delete field">
          <IconButton
            type="submit"
            color="error"
            aria-label={`Delete ${field.label}`}
          >
            <DeleteOutlineRounded />
          </IconButton>
        </Tooltip>
      </Form>
    </Box>
  );
}

export default function Dashboard({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { profile, designs, orders, measurementFields, orderFilter } =
    loaderData;
  const action = (actionData ?? {}) as DashboardActionData;
  const verified = profile.verification_status === "verified";
  const filteredOrders = filterOrders(orders, orderFilter);
  const returnTo = `/dashboard?orders=${orderFilter}#orders`;
  const liveOrders = orders.filter(
    (order) => order.status !== "fulfilled" && order.status !== "cancelled",
  );
  const paidMinor = orders.reduce((sum, order) => sum + order.settled_minor, 0);
  const customCount = orders.filter(
    (order) => order.order_type === "custom",
  ).length;
  const pendingPayments = countOrders(orders, "draft");
  const needsMeasurements = orders.filter((order) =>
    Boolean(measurementSourceFor(order)),
  ).length;
  const storefrontURL = `https://${profile.handle}.xtiitch.com`;
  const nextFieldSequence =
    measurementFields.length === 0
      ? 1
      : Math.max(...measurementFields.map((field) => field.sequence)) + 1;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px)`,
        backgroundSize: "36px 36px",
      }}
    >
      <Box
        sx={{
          maxWidth: 1500,
          mx: "auto",
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          py: { xs: 1.5, lg: 3 },
          display: "grid",
          gap: { xs: 2, lg: 3 },
          gridTemplateColumns: { xs: "1fr", lg: "270px minmax(0, 1fr)" },
        }}
      >
        <Panel
          sx={{
            p: 2,
            position: { lg: "sticky" },
            top: { lg: 24 },
            alignSelf: "start",
            minHeight: { lg: "calc(100vh - 48px)" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack spacing={2} sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(tokens.burgundy, 0.1),
                  color: "primary.main",
                }}
              >
                <StorefrontRounded />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900 }} noWrap>
                  {profile.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary" }}
                  noWrap
                >
                  {profile.plan} plan · {profile.handle}
                </Typography>
              </Box>
            </Stack>

            <ToneChip
              label={verified ? "Verified for payments" : "Verification needed"}
              tone={verified ? tokens.success : tokens.warning}
              icon={
                verified ? <VerifiedUserRounded /> : <WarningAmberRounded />
              }
            />

            <Divider />

            <Stack spacing={0.75}>
              {workspaceNav.map((item) => (
                <Button
                  key={item.href}
                  href={item.href}
                  startIcon={item.icon}
                  sx={{
                    justifyContent: "flex-start",
                    color: "text.primary",
                    bgcolor: alpha(tokens.ink, 0.035),
                    "&:hover": {
                      bgcolor: alpha(tokens.burgundy, 0.08),
                      color: "primary.main",
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>

            <Box sx={{ mt: "auto" }}>
              <Button
                component={MuiLink}
                href={storefrontURL}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                startIcon={<VisibilityRounded />}
                fullWidth
              >
                View storefront
              </Button>
              <Form method="post">
                <input type="hidden" name="intent" value="logout" />
                <Button
                  type="submit"
                  color="inherit"
                  startIcon={<LogoutRounded />}
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  Log out
                </Button>
              </Form>
            </Box>
          </Stack>
        </Panel>

        <Box sx={{ minWidth: 0 }}>
          <Panel
            sx={{
              p: { xs: 2.5, md: 4 },
              mb: 2.5,
              bgcolor: tokens.charcoal,
              color: "common.white",
              borderColor: alpha(tokens.ink, 0.1),
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              sx={{ justifyContent: "space-between" }}
            >
              <Box sx={{ maxWidth: 760 }}>
                <Typography
                  variant="overline"
                  sx={{ color: alpha(tokens.white, 0.64), fontWeight: 900 }}
                >
                  Studio command room
                </Typography>
                <Typography variant="h3" component="h1" sx={{ mt: 0.75 }}>
                  Keep every garment moving without losing the customer thread.
                </Typography>
                <Typography
                  sx={{
                    mt: 1.5,
                    color: alpha(tokens.white, 0.72),
                    maxWidth: 680,
                  }}
                >
                  Orders, payments, customer contact, catalogue work, and
                  measurement setup now sit in one practical workspace.
                </Typography>
              </Box>
              <Stack spacing={1} sx={{ minWidth: { md: 260 } }}>
                <InfoStrip
                  icon={<ReceiptLongRounded />}
                  tone={tokens.gold}
                  title={`${liveOrders.length} live orders`}
                  helper={`${pendingPayments} awaiting payment`}
                />
                <InfoStrip
                  icon={<StraightenRounded />}
                  tone={tokens.info}
                  title={`${needsMeasurements} need fitting data`}
                  helper={`${measurementFields.length} fields configured`}
                />
              </Stack>
            </Stack>
          </Panel>

          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                xl: "repeat(4, 1fr)",
              },
            }}
          >
            <MetricCard
              icon={<ReceiptLongRounded />}
              label="Live orders"
              value={String(liveOrders.length)}
              helper="Confirmed or awaiting work"
            />
            <MetricCard
              icon={<RadioButtonUncheckedRounded />}
              label="Awaiting payment"
              value={String(pendingPayments)}
              helper="Needs checkout completion"
              tone={tokens.warning}
            />
            <MetricCard
              icon={<PaymentsRounded />}
              label="Settled through Xtiitch"
              value={formatGHS(paidMinor)}
              helper="Tracked via Paystack rails"
              tone={tokens.success}
            />
            <MetricCard
              icon={<Inventory2Rounded />}
              label="Custom orders"
              value={String(customCount)}
              helper="Bespoke route volume"
              tone={tokens.info}
            />
          </Box>

          <Box
            sx={{
              mt: 2.5,
              display: "grid",
              gap: { xs: 2.5, xl: 3 },
              gridTemplateColumns: {
                xs: "1fr",
                xl: "minmax(0, 1.35fr) minmax(360px, 0.65fr)",
              },
              alignItems: "start",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack spacing={2.5}>
                <Box id="orders">
                  <SectionHeader
                    eyebrow="Orders"
                    title="Production board"
                    helper={`${filteredOrders.length} of ${orders.length} orders in this view. Advance only confirmed orders; drafts wait for payment.`}
                    action={
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flexWrap: "wrap" }}
                      >
                        {orderFilters.map((filter) => (
                          <Button
                            key={filter.value}
                            component={RouterLink}
                            to={`/dashboard?orders=${filter.value}#orders`}
                            size="small"
                            variant={
                              orderFilter === filter.value
                                ? "contained"
                                : "outlined"
                            }
                          >
                            {filter.label} ({countOrders(orders, filter.value)})
                          </Button>
                        ))}
                      </Stack>
                    }
                  />

                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {action.orderError ? (
                      <Alert severity="warning">{action.orderError}</Alert>
                    ) : null}
                    {action.measurementError ? (
                      <Alert severity="warning">
                        {action.measurementError}
                      </Alert>
                    ) : null}
                    {filteredOrders.length === 0 ? (
                      <EmptyState
                        icon={<CheckCircleRounded sx={{ fontSize: 42 }} />}
                        title="No orders in this view"
                        helper="New checkout, custom, and walk-in orders will land here as soon as they are created."
                      />
                    ) : (
                      filteredOrders.map((order) => (
                        <OrderCard
                          key={order.order_id}
                          order={order}
                          returnTo={returnTo}
                          measurementFields={measurementFields}
                        />
                      ))
                    )}
                  </Stack>
                </Box>

                <Box id="catalogue">
                  <SectionHeader
                    eyebrow="Catalogue"
                    title="Design studio"
                    helper="Add storefront designs, retire unavailable pieces, and keep product imagery tidy."
                  />
                  <Box
                    sx={{
                      mt: 2,
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: {
                        xs: "1fr",
                        lg: "minmax(320px, 0.44fr) minmax(0, 0.56fr)",
                      },
                    }}
                  >
                    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{ alignItems: "center", mb: 2 }}
                      >
                        <Box sx={{ color: "primary.main" }}>
                          <ContentCutRounded />
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 900 }}>
                            Add a design
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            Publish a new piece to the storefront.
                          </Typography>
                        </Box>
                      </Stack>
                      <Form method="post">
                        <input type="hidden" name="intent" value="create" />
                        <Stack spacing={1.75}>
                          {action.designError ? (
                            <Alert severity="error">{action.designError}</Alert>
                          ) : null}
                          <TextField
                            name="title"
                            label="Title"
                            required
                            fullWidth
                          />
                          <TextField
                            name="description"
                            label="Description"
                            fullWidth
                            multiline
                            minRows={3}
                          />
                          <TextField
                            name="image_url"
                            label="Image URL"
                            fullWidth
                            placeholder="https://..."
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <DesignServicesRounded fontSize="small" />
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                          <FormControlLabel
                            control={<Checkbox name="customisation" />}
                            label="Allow customisation"
                          />
                          <Button
                            type="submit"
                            variant="contained"
                            startIcon={<AddRounded />}
                          >
                            Add design
                          </Button>
                        </Stack>
                      </Form>
                    </Panel>

                    <Panel>
                      <Box
                        sx={{
                          p: { xs: 2, md: 2.5 },
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 900 }}>
                            Designs
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {designs.length} total pieces
                          </Typography>
                        </Box>
                        <ToneChip
                          label={`${designs.filter((design) => design.status === "active").length} active`}
                          tone={tokens.success}
                        />
                      </Box>
                      {designs.length === 0 ? (
                        <Box sx={{ px: 2.5, pb: 2.5 }}>
                          <EmptyState
                            icon={
                              <DesignServicesRounded sx={{ fontSize: 38 }} />
                            }
                            title="No designs yet"
                            helper="Add your first design with an image URL so customers can browse the store."
                          />
                        </Box>
                      ) : (
                        designs.map((design) => (
                          <DesignRow key={design.design_id} design={design} />
                        ))
                      )}
                    </Panel>
                  </Box>
                </Box>
              </Stack>
            </Box>

            <Stack spacing={2.5} sx={{ minWidth: 0 }}>
              <Panel id="measurements">
                <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{ alignItems: "center" }}
                  >
                    <Box sx={{ color: "primary.main" }}>
                      <StraightenRounded />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>
                        Measurement setup
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        Define the fields used for self, visit, and shop
                        measurements.
                      </Typography>
                    </Box>
                  </Stack>
                  {action.fieldError ? (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {action.fieldError}
                    </Alert>
                  ) : null}
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="create_measurement_field"
                    />
                    <Box
                      sx={{
                        mt: 2,
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "minmax(0, 1fr) 96px 96px",
                        },
                      }}
                    >
                      <TextField
                        name="label"
                        label="Field label"
                        placeholder="Chest"
                        size="small"
                        required
                      />
                      <TextField
                        name="unit"
                        label="Unit"
                        select
                        defaultValue="in"
                        size="small"
                      >
                        {fieldUnits.map((unit) => (
                          <MenuItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        name="sequence"
                        label="Order"
                        type="number"
                        defaultValue={nextFieldSequence}
                        size="small"
                        slotProps={{ htmlInput: { min: 0 } }}
                        required
                      />
                    </Box>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<AddRounded />}
                      sx={{ mt: 1.5 }}
                    >
                      Add field
                    </Button>
                  </Form>
                </Box>

                {measurementFields.length === 0 ? (
                  <Box sx={{ px: 2.5, pb: 2.5 }}>
                    <EmptyState
                      icon={<StraightenRounded sx={{ fontSize: 38 }} />}
                      title="No measurement fields yet"
                      helper="Add fields such as chest, waist, sleeve, and length before staff record visit or shop measurements."
                    />
                  </Box>
                ) : (
                  measurementFields.map((field) => (
                    <MeasurementFieldRow key={field.field_id} field={field} />
                  ))
                )}
              </Panel>

              <Panel sx={{ p: { xs: 2, md: 2.5 }, bgcolor: tokens.panel }}>
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box sx={{ color: "primary.main", pt: 0.4 }}>
                    <TuneRounded />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>
                      Today’s focus
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.75, color: "text.secondary" }}
                    >
                      Clear drafts first, then record measurements for confirmed
                      visit/shop custom orders. Xtiitch records payment state
                      but never holds funds.
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ mt: 1.5, flexWrap: "wrap" }}
                    >
                      <ToneChip
                        label={`${pendingPayments} payment follow-ups`}
                        tone={tokens.warning}
                      />
                      <ToneChip
                        label={`${needsMeasurements} measurement captures`}
                        tone={tokens.info}
                      />
                    </Stack>
                  </Box>
                </Stack>
              </Panel>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
