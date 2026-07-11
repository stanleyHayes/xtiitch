import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { HandoverSummary, OrderSummary } from "../shared/types";
import { fulfilledOrdersWithoutOpenHandover } from "../orders/utils";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { handoverMethods } from "../shared/constants";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { formatMethod } from "../money/utils";
import {
  shortDateTime,
  canAdvanceHandover,
  handoverTone,
  handoverActionLabel,
} from "../shared/utils";
import { ToneChip } from "../../components/ui/ToneChip";
import { InfoStrip } from "../studio/InfoStrip";
import { PaginationFooter } from "../../components/ui/PaginationFooter";

export function HandoverPanel({
  handovers,
  orders,
  error,
}: {
  handovers: HandoverSummary[];
  orders: OrderSummary[];
  error?: string;
}) {
  const handoverOrders = fulfilledOrdersWithoutOpenHandover(orders, handovers);
  // Segment handovers by fulfilment type (delivery vs pickup) so the owner can
  // separate dispatch from collect-in-person, plus filter by status.
  const [methodFilter, setMethodFilter] = useState<
    "all" | "delivery" | "pickup"
  >("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const deliveryCount = handovers.filter((h) => h.method === "delivery").length;
  const pickupCount = handovers.filter((h) => h.method === "pickup").length;
  const statusOptions = Array.from(
    new Set(handovers.map((handover) => handover.status)),
  );
  const visibleHandovers = handovers.filter((handover) => {
    if (methodFilter !== "all" && handover.method !== methodFilter) {
      return false;
    }
    if (statusFilter !== "all" && handover.status !== statusFilter) {
      return false;
    }
    return true;
  });
  const {
    page: handoverPage,
    pageCount: handoverPageCount,
    pagedItems: pagedHandovers,
    setPage: setHandoverPage,
  } = usePagedItems(
    visibleHandovers,
    6,
    `${methodFilter}:${statusFilter}:${visibleHandovers.length}`,
  );

  return (
    <Panel id="handovers">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <LocalShippingRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Handover desk</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Arrange pickup or delivery once an order is fulfilled.
            </Typography>
          </Box>
        </Stack>

        <Form method="post">
          <input type="hidden" name="intent" value="arrange_handover" />
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {error ? <Alert severity="warning">{error}</Alert> : null}
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(0, 1.2fr) minmax(130px, 0.5fr)",
                },
              }}
            >
              <TextField
                name="order_id"
                label="Fulfilled order"
                select
                size="small"
                defaultValue={handoverOrders[0]?.order_id ?? ""}
                disabled={handoverOrders.length === 0}
                required
              >
                {handoverOrders.length === 0 ? (
                  <MenuItem value="">No fulfilled orders ready</MenuItem>
                ) : null}
                {handoverOrders.map((order) => (
                  <MenuItem key={order.order_id} value={order.order_id}>
                    {order.design_title} · {order.customer_name || "Customer"}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                name="method"
                label="Method"
                select
                defaultValue="pickup"
                size="small"
              >
                {handoverMethods.map((method) => (
                  <MenuItem key={method.value} value={method.value}>
                    {method.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              }}
            >
              <TextField name="recipient_name" label="Recipient" size="small" />
              <TextField
                name="recipient_phone"
                label="Recipient phone"
                size="small"
              />
              <TextField name="courier" label="Courier or rider" size="small" />
              <TextField name="note" label="Note" size="small" />
            </Box>
            <TextField
              name="address"
              label="Delivery address"
              size="small"
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddRounded />}
              disabled={handoverOrders.length === 0}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              Arrange handover
            </Button>
          </Stack>
        </Form>
      </Box>

      {handovers.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <InlineEmptyState
            icon={<LocalShippingRounded sx={{ fontSize: 38 }} />}
            title="No handovers yet"
            helper="Fulfilled orders can be turned into pickup or delivery handovers from this desk."
          />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              px: { xs: 2, md: 2.5 },
              py: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              sx={{ gap: 1, alignItems: { md: "center" } }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1, flex: 1 }}
              >
                {(
                  [
                    { value: "all", label: `All (${handovers.length})` },
                    { value: "delivery", label: `Delivery (${deliveryCount})` },
                    { value: "pickup", label: `Pickup (${pickupCount})` },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.value}
                    size="small"
                    variant={
                      methodFilter === option.value ? "contained" : "outlined"
                    }
                    onClick={() => setMethodFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </Stack>
              <TextField
                select
                size="small"
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Box>
          {visibleHandovers.length === 0 ? (
            <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2.5 }}>
              <InlineEmptyState
                icon={<LocalShippingRounded sx={{ fontSize: 38 }} />}
                title="No matching handovers"
                helper="Try a different fulfilment type or status filter."
              />
            </Box>
          ) : null}
          {pagedHandovers.map((handover) => {
            const active = canAdvanceHandover(handover.status);
            return (
              <Box
                key={handover.handover_id}
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.75,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }} noWrap>
                        {handover.customer_name || "Customer"} ·{" "}
                        {handover.design_title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {formatMethod(handover.method)} ·{" "}
                        {shortDateTime(handover.created_at)}
                      </Typography>
                    </Box>
                    <ToneChip
                      label={handover.status}
                      tone={handoverTone(handover.status)}
                    />
                  </Stack>
                  <InfoStrip
                    icon={<PhoneRounded />}
                    tone={tokens.info}
                    title={
                      handover.recipient_phone ||
                      handover.customer_phone ||
                      "No phone captured"
                    }
                    helper={
                      handover.address ||
                      handover.recipient_name ||
                      handover.note ||
                      "Pickup from shop"
                    }
                  />
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    sx={{ alignItems: { xs: "stretch", md: "center" } }}
                  >
                    <Form method="post" style={{ flex: 1 }}>
                      <input
                        type="hidden"
                        name="intent"
                        value="advance_handover"
                      />
                      <input
                        type="hidden"
                        name="handover_id"
                        value={handover.handover_id}
                      />
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                      >
                        <TextField
                          name="courier"
                          label="Courier"
                          size="small"
                          defaultValue={handover.courier}
                          disabled={!active}
                          fullWidth
                        />
                        <TextField
                          name="note"
                          label="Note"
                          size="small"
                          defaultValue={handover.note}
                          disabled={!active}
                          fullWidth
                        />
                        <Button
                          type="submit"
                          variant="outlined"
                          disabled={!active}
                          sx={{ minWidth: 150 }}
                        >
                          {handoverActionLabel(handover)}
                        </Button>
                      </Stack>
                    </Form>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="cancel_handover"
                      />
                      <input
                        type="hidden"
                        name="handover_id"
                        value={handover.handover_id}
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        color="error"
                        disabled={!active}
                        fullWidth
                      >
                        Cancel
                      </Button>
                    </Form>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
          {visibleHandovers.length > 0 ? (
            <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
              <PaginationFooter
                count={handoverPageCount}
                label="handovers"
                page={handoverPage}
                pageSize={6}
                total={visibleHandovers.length}
                onChange={setHandoverPage}
              />
            </Box>
          ) : null}
        </>
      )}
    </Panel>
  );
}