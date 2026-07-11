import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { MiniStat } from "../../components/ui/MiniStat";
import { WalkInOrderPanel } from "../money/WalkInOrderPanel";
import { OrdersWorkspace } from "./OrdersWorkspace";
import { orderFilters } from "../shared/constants";
import { countOrders } from "./utils";
import type { MeasurementField, OrderSummary, Stage } from "../shared/types";
import { tokens } from "../../theme";

export function OrdersSection({
  canManage,
  orders,
  filteredOrders,
  stages,
  measurementFields,
  orderFilter,
  pendingPayments,
  needsMeasurements,
  readyForHandover,
  returnTo,
  walkInError,
  orderError,
  measurementError,
}: {
  canManage: boolean;
  orders: OrderSummary[];
  filteredOrders: OrderSummary[];
  stages: Stage[];
  measurementFields: MeasurementField[];
  orderFilter: string;
  pendingPayments: number;
  needsMeasurements: number;
  readyForHandover: number;
  returnTo: string;
  walkInError?: string;
  orderError?: string;
  measurementError?: string;
}) {
  return (
    <Box id="orders">
      <SectionHeader
        eyebrow="Orders"
        title="Production board"
        helper={`${filteredOrders.length} of ${orders.length} orders in this view. Advance only confirmed orders; drafts wait for payment.`}
        action={
          <Stack
            direction="row"
            spacing={0.85}
            useFlexGap
            sx={{
              maxWidth: "100%",
              flexWrap: { xs: "nowrap", sm: "wrap" },
              overflowX: { xs: "auto", sm: "visible" },
              pb: { xs: 0.4, sm: 0 },
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {orderFilters.map((filter) => {
              const selected = orderFilter === filter.value;
              const count = countOrders(orders, filter.value);
              return (
                <Button
                  key={filter.value}
                  component={RouterLink}
                  to={`/dashboard/orders?orders=${filter.value}`}
                  disableElevation
                  sx={{
                    flexShrink: 0,
                    px: 1.5,
                    py: 0.55,
                    minHeight: 36,
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 800,
                    fontSize: 13,
                    lineHeight: 1,
                    color: selected ? tokens.white : "text.primary",
                    bgcolor: selected ? tokens.burgundy : "action.hover",
                    border: "1px solid",
                    borderColor: selected ? tokens.burgundy : "divider",
                    boxShadow: selected
                      ? `0 6px 16px ${alpha(tokens.burgundy, 0.26)}`
                      : "none",
                    transition:
                      "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
                    "&:hover": {
                      bgcolor: selected
                        ? tokens.burgundy
                        : alpha(tokens.burgundy, 0.08),
                      borderColor: selected
                        ? tokens.burgundy
                        : alpha(tokens.burgundy, 0.3),
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center" }}
                  >
                    <Box component="span">{filter.label}</Box>
                    <Box
                      component="span"
                      sx={{
                        minWidth: 20,
                        height: 20,
                        px: 0.5,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 900,
                        color: selected ? tokens.white : "text.secondary",
                        bgcolor: selected
                          ? alpha(tokens.white, 0.24)
                          : "action.selected",
                      }}
                    >
                      {count}
                    </Box>
                  </Stack>
                </Button>
              );
            })}
          </Stack>
        }
      />

      {canManage ? (
        <Box sx={{ mt: 2 }}>
          <WalkInOrderPanel
            designs={[]}
            sizeBands={[]}
            measurementFields={measurementFields}
            error={walkInError}
          />
        </Box>
      ) : null}

      <Box
        sx={{
          mt: 2,
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MiniStat
          icon={<ReceiptLongRounded fontSize="small" />}
          label="In this view"
          value={String(filteredOrders.length)}
          helper={`${orders.length} total orders`}
          tone={tokens.burgundy}
        />
        <MiniStat
          icon={<PaymentsRounded fontSize="small" />}
          label="Draft pay"
          value={String(pendingPayments)}
          helper="Waiting for checkout"
          tone={tokens.warning}
        />
        <MiniStat
          icon={<StraightenRounded fontSize="small" />}
          label="Measurements"
          value={String(needsMeasurements)}
          helper="Visit or shop captures"
          tone={tokens.info}
        />
        <MiniStat
          icon={<LocalShippingRounded fontSize="small" />}
          label="Ready handover"
          value={String(readyForHandover)}
          helper="Fulfilled and waiting"
          tone={tokens.success}
        />
      </Box>

      <Stack spacing={1.5} sx={{ mt: 2 }}>
        {orderError ? <Alert severity="warning">{orderError}</Alert> : null}
        {measurementError ? (
          <Alert severity="warning">{measurementError}</Alert>
        ) : null}
        <OrdersWorkspace
          orders={filteredOrders}
          stages={stages}
          returnTo={returnTo}
          measurementFields={measurementFields}
          showMoneyDetails={canManage}
        />
      </Stack>
    </Box>
  );
}
