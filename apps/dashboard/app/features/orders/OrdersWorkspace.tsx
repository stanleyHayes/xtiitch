import { useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { OrderSummary, Stage, MeasurementField } from "../shared/types";
import { EmptyState } from "../../components/ui/EmptyState";
import { OrdersTable } from "./OrdersTable";
import { OrdersKanban } from "./OrdersKanban";

export function OrdersWorkspace({
  orders,
  stages,
  returnTo,
  measurementFields,
  showMoneyDetails,
}: {
  orders: OrderSummary[];
  stages: Stage[];
  returnTo: string;
  measurementFields: MeasurementField[];
  showMoneyDetails: boolean;
}) {
  const [view, setView] = useState<"table" | "board">("table");

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircleRounded sx={{ fontSize: 42 }} />}
        title="No orders in this view"
        helper="New checkout, custom, and walk-in orders will land here as soon as they are created."
      />
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button
          size="small"
          variant={view === "table" ? "contained" : "outlined"}
          onClick={() => setView("table")}
        >
          Table
        </Button>
        <Button
          size="small"
          variant={view === "board" ? "contained" : "outlined"}
          onClick={() => setView("board")}
        >
          Board
        </Button>
      </Stack>
      {view === "table" ? (
        <OrdersTable
          orders={orders}
          returnTo={returnTo}
          measurementFields={measurementFields}
          showMoneyDetails={showMoneyDetails}
        />
      ) : (
        <OrdersKanban
          orders={orders}
          stages={stages}
          returnTo={returnTo}
          showMoneyDetails={showMoneyDetails}
        />
      )}
    </Stack>
  );
}