import { useState } from "react";
import { Form, Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { alpha, type Theme } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { formatGHS } from "../../lib/format";
import type { CustomerOrder } from "../../lib/discovery";
import {
  groupOrdersByStore,
  kindLabel,
  splitTabs,
  type OrderBasket,
} from "../../lib/orders";
import { OrderActions } from "./order-actions";
import {
  formatDate,
  orderStatus,
  type OrderStatusTone,
} from "./utils";

// §5.3: the customer account's orders panel — grouped by store basket exactly
// as bought, segmented into "Current orders" and "Archived orders" tabs, with
// per-design and whole-basket "Received" acknowledgements and the store's
// phone on every order.
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
  const hasAwaitingPayment = orders.some(
    (order) => order.status.toLowerCase() === "draft",
  );

  return (
    <Box>
      {notice ? (
        <Alert
          icon={<CheckCircleRounded fontSize="inherit" />}
          severity="success"
          sx={{ mb: 2 }}
        >
          {notice}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {hasAwaitingPayment ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Awaiting payment orders expire after 24 hours. Pay now or close an
          order you no longer want.
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onChange={(_event, value: "current" | "archived") => setTab(value)}
        variant="fullWidth"
        aria-label="Order history"
        sx={{
          mb: 2,
          minHeight: 44,
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTab-root": {
            minWidth: 0,
            minHeight: 44,
            px: { xs: 0.5, sm: 2 },
            whiteSpace: "nowrap",
          },
        }}
      >
        <Tab
          value="current"
          label={`Current orders (${tabs.current.length})`}
          sx={{ fontWeight: 800, textTransform: "none" }}
        />
        <Tab
          value="archived"
          label={`Archived orders (${tabs.archived.length})`}
          sx={{ fontWeight: 800, textTransform: "none" }}
        />
      </Tabs>

      {groups.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <StorefrontRounded
            sx={{ fontSize: 40, color: "text.disabled" }}
          />
          <Typography sx={{ mt: 1, fontWeight: 800 }}>
            {tab === "current" ? "No current orders" : "Nothing archived yet"}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {tab === "current"
              ? "When you order from a studio, it shows up here."
              : "Orders the store has finished land here for you to acknowledge."}
          </Typography>
          {tab === "current" ? (
            <Button
              component={RouterLink}
              to="/"
              variant="contained"
              sx={{ mt: 2.5 }}
              endIcon={<ArrowForwardRounded />}
            >
              Browse designs
            </Button>
          ) : null}
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {groups.map((group) => (
            <Box key={group.storeHandle}>
              {/* §5.3.1: orders group under the store they were bought from. */}
              <Typography
                variant="overline"
                sx={{ color: "text.secondary", fontWeight: 900 }}
              >
                {group.storeName}
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 0.75 }}>
                {group.baskets.map((basket, index) => (
                  <BasketCard
                    key={basket.groupId ?? `single-${index}`}
                    basket={basket}
                    archived={tab === "archived"}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function BasketCard({
  basket,
  archived,
}: {
  basket: OrderBasket;
  archived: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: "10px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(var(--surface-rgb), 0.6)",
      }}
    >
      {basket.groupId ? (
        <Stack
          direction="row"
          sx={{
            mb: 1,
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 800 }}
          >
            Basket · {basket.orders.length}{" "}
            {basket.orders.length === 1 ? "design" : "designs"}
          </Typography>
        </Stack>
      ) : null}
      <Stack spacing={1.5} divider={<Divider flexItem />}>
        {basket.orders.map((order) => (
          <OrderRow key={order.order_id} order={order} archived={archived} />
        ))}
      </Stack>
      {/* §5.3.2: the whole-basket "Received" — one tap acknowledges every
          final-stage design in this store basket (both tabs carry it). */}
      {basket.groupId ? (
        <Form method="post">
          <input type="hidden" name="intent" value="mark_basket_received" />
          <input
            type="hidden"
            name="checkout_group_id"
            value={basket.groupId}
          />
          <Button
            type="submit"
            size="small"
            variant="outlined"
            startIcon={<CheckCircleRounded />}
            sx={{ mt: 1.5, fontWeight: 800 }}
          >
            Mark whole basket received
          </Button>
        </Form>
      ) : null}
    </Box>
  );
}

function OrderRow({
  order,
  archived,
}: {
  order: CustomerOrder;
  archived: boolean;
}) {
  const status = orderStatus(order.status);
  const toneColor = (theme: Theme) => orderStatusColor(theme, status.tone);
  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          gap: 1.5,
          alignItems: "flex-start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap>
            {order.design_title || "Custom order"}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {kindLabel(order.kind)} · {formatDate(order.created_at)}
          </Typography>
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            px: 1,
            py: 0.35,
            borderRadius: 999,
            bgcolor: (theme) => alpha(toneColor(theme), 0.12),
            color: toneColor,
            border: "1px solid",
            borderColor: (theme) => alpha(toneColor(theme), 0.4),
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
          }}
        >
          {status.label}
        </Box>
      </Stack>
      <Stack
        sx={{
          mt: 1,
          gap: 1.25,
          alignItems: "stretch",
        }}
      >
        <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
          {order.agreed_total_minor > 0
            ? formatGHS(order.agreed_total_minor)
            : "Price on confirmation"}
        </Typography>
        <OrderActions order={order} archived={archived} />
      </Stack>
    </Box>
  );
}

function orderStatusColor(theme: Theme, tone: OrderStatusTone): string {
  if (tone === "neutral") return theme.palette.text.secondary;
  return theme.palette[tone].main;
}
