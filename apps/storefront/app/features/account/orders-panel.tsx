import { useEffect, useMemo, useState } from "react";
import { Form, Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { alpha, type Theme } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { formatGHS } from "../../lib/format";
import type { CustomerOrder } from "../../lib/discovery";
import { groupOrdersByStore, kindLabel, splitTabs } from "../../lib/orders";
import { tokens } from "../../theme";
import { OrderActions } from "./order-actions";
import { formatDate, orderStatus, type OrderStatusTone } from "./utils";

const JOURNEY = ["Order placed", "In production", "Ready", "Completed"];

export function OrdersPanel({
  orders,
  notice,
  error,
}: {
  orders: CustomerOrder[];
  notice?: string;
  error?: string;
}) {
  const [tab, setTab] = useState<"current" | "archived">("current");
  const tabs = splitTabs(orders);
  const shown = tab === "current" ? tabs.current : tabs.archived;
  const groups = groupOrdersByStore(shown);
  const [selectedId, setSelectedId] = useState(shown[0]?.order_id ?? "");
  const selected = useMemo(
    () => shown.find((order) => order.order_id === selectedId) ?? shown[0],
    [selectedId, shown],
  );
  const hasAwaitingPayment = orders.some(
    (order) => order.status.toLowerCase() === "draft",
  );

  useEffect(() => {
    if (!shown.some((order) => order.order_id === selectedId)) {
      setSelectedId(shown[0]?.order_id ?? "");
    }
  }, [selectedId, shown]);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1.5 }}
      >
        <Box>
          <Typography variant="h5" component="h2">Your orders</Typography>
          <Typography variant="body2" sx={{ mt: 0.4, color: "text.secondary" }}>
            Select an order to see its full journey and available actions.
          </Typography>
        </Box>
        <Tabs
          value={tab}
          onChange={(_event, value: "current" | "archived") => setTab(value)}
          aria-label="Order history"
          sx={{
            minHeight: 42,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 999,
            p: 0.375,
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.025),
            "& .MuiTabs-indicator": { display: "none" },
            "& .MuiTab-root": {
              minHeight: 34,
              minWidth: 0,
              px: { xs: 1.25, sm: 1.75 },
              borderRadius: 999,
              fontWeight: 850,
              textTransform: "none",
            },
            "& .Mui-selected": {
              color: `${tokens.white} !important`,
              bgcolor: "primary.main",
            },
          }}
        >
          <Tab value="current" label={`Current (${tabs.current.length})`} />
          <Tab value="archived" label={`Archived (${tabs.archived.length})`} />
        </Tabs>
      </Stack>

      <Stack spacing={1.25} sx={{ mt: 2.5 }}>
        {notice ? <Alert icon={<CheckCircleRounded fontSize="inherit" />} severity="success">{notice}</Alert> : null}
        {error ? <Alert severity="warning">{error}</Alert> : null}
        {hasAwaitingPayment && tab === "current" ? (
          <Alert severity="info">
            Awaiting-payment orders expire after 24 hours. Pay now or close an order you no longer want.
          </Alert>
        ) : null}
      </Stack>

      {groups.length === 0 ? (
        <EmptyOrders tab={tab} />
      ) : (
        <Box
          sx={{
            mt: 3,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(240px, 0.72fr) minmax(0, 1.28fr)" },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <Stack spacing={2}>
            {groups.map((group) => (
              <Box key={group.storeHandle}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                  <StorefrontRounded sx={{ color: "primary.main", fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 950 }}>
                    {group.storeName}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  {group.baskets.flatMap((basket) =>
                    basket.orders.map((order) => (
                      <OrderSelector
                        key={order.order_id}
                        order={order}
                        selected={selected?.order_id === order.order_id}
                        onSelect={() => setSelectedId(order.order_id)}
                      />
                    )),
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
          {selected ? <OrderDetail order={selected} archived={tab === "archived"} /> : null}
        </Box>
      )}
    </Box>
  );
}

function EmptyOrders({ tab }: { tab: "current" | "archived" }) {
  return (
    <Box
      sx={{
        mt: 3,
        py: { xs: 5, md: 7 },
        px: 2,
        textAlign: "center",
        borderRadius: 2.5,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025),
      }}
    >
      <Inventory2Rounded sx={{ fontSize: 44, color: "text.disabled" }} />
      <Typography variant="h6" sx={{ mt: 1.25 }}>
        {tab === "current" ? "Your order journey starts here" : "Nothing archived yet"}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
        {tab === "current"
          ? "Once you order from a studio, every update will appear here."
          : "Completed orders stay here until you confirm that you received them."}
      </Typography>
      {tab === "current" ? (
        <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 2.5 }} endIcon={<ArrowForwardRounded />}>
          Explore storefronts
        </Button>
      ) : null}
    </Box>
  );
}

function OrderSelector({
  order,
  selected,
  onSelect,
}: {
  order: CustomerOrder;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = orderStatus(order.status);
  const toneColor = (theme: Theme) => orderStatusColor(theme, status.tone);
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        width: "100%",
        p: 1.5,
        textAlign: "left",
        font: "inherit",
        color: "text.primary",
        cursor: "pointer",
        borderRadius: 2,
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? (theme) => alpha(theme.palette.primary.main, 0.065) : "transparent",
        transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease",
        "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
        "&:focus-visible": { outline: "3px solid", outlineColor: (theme) => alpha(theme.palette.primary.main, 0.25) },
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontWeight: 900 }} noWrap>{order.design_title || "Custom order"}</Typography>
        <Typography sx={{ fontWeight: 900, color: "primary.main", whiteSpace: "nowrap" }}>
          {order.agreed_total_minor > 0 ? formatGHS(order.agreed_total_minor) : "On confirmation"}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ display: "block", mt: 0.25, color: "text.secondary" }}>
        {kindLabel(order.kind)} · {formatDate(order.created_at)}
      </Typography>
      <Box
        sx={{
          display: "inline-flex",
          mt: 1,
          px: 1,
          py: 0.3,
          borderRadius: 999,
          color: toneColor,
          bgcolor: (theme) => alpha(toneColor(theme), 0.1),
          fontSize: 11,
          fontWeight: 850,
        }}
      >
        {status.label}
      </Box>
    </Box>
  );
}

function OrderDetail({ order, archived }: { order: CustomerOrder; archived: boolean }) {
  const status = orderStatus(order.status);
  const activeStep = journeyStep(order.status);
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72),
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1.5 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 900 }}>
            {order.business_name} · Order {order.order_id.slice(0, 8).toUpperCase()}
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.4 }}>{order.design_title || "Custom order"}</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
            {kindLabel(order.kind)} · Placed {formatDate(order.created_at)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: { sm: "right" } }}>
          <Typography variant="h6" sx={{ color: "primary.main" }}>
            {order.agreed_total_minor > 0 ? formatGHS(order.agreed_total_minor) : "Price on confirmation"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{status.label}</Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2 }}>Order journey</Typography>
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{
          mx: { xs: -1, sm: 0 },
          "& .MuiStepLabel-label": { mt: 0.75, fontSize: { xs: 10, sm: 12 }, fontWeight: 750 },
          "& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed": { color: "primary.main" },
        }}
      >
        {JOURNEY.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {order.status.toLowerCase() === "draft" ? (
        <Alert severity="warning" sx={{ mt: 2.5 }}>
          Payment is still required. This order automatically closes 24 hours after it was created.
        </Alert>
      ) : null}
      <Box sx={{ mt: 2.5 }}><OrderActions order={order} archived={archived} /></Box>
      {order.checkout_group_id && archived ? (
        <Form method="post">
          <input type="hidden" name="intent" value="mark_basket_received" />
          <input type="hidden" name="checkout_group_id" value={order.checkout_group_id} />
          <Button type="submit" size="small" variant="outlined" startIcon={<CheckCircleRounded />} sx={{ mt: 1.5, fontWeight: 800 }}>
            Mark whole basket received
          </Button>
        </Form>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ mt: 2.5, color: "text.secondary", alignItems: "center" }}>
        <ReceiptLongRounded fontSize="small" />
        <Typography variant="caption">Order updates are synced with the studio in real time.</Typography>
      </Stack>
    </Box>
  );
}

function journeyStep(status: string): number {
  const value = status.toLowerCase();
  if (["completed", "delivered", "fulfilled", "handed_over"].includes(value)) return 3;
  if (["ready", "ready_for_handover", "ready_for_pickup"].includes(value)) return 2;
  if (["in_production", "production", "fitting", "order_placed"].includes(value)) return 1;
  return 0;
}

function orderStatusColor(theme: Theme, tone: OrderStatusTone): string {
  if (tone === "neutral") return theme.palette.text.secondary;
  return theme.palette[tone].main;
}
