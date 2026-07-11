import { useState } from "react";
import Stack from "@mui/material/Stack";
import { Panel } from "../../../components/ui/Panel";
import type { MeasurementField, OrderSummary } from "../../shared/types";
import { OrderActions } from "./OrderActions";
import { OrderHeader } from "./OrderHeader";
import { OrderItems } from "./OrderItems";

export function OrderCard({
  order,
  returnTo,
  measurementFields,
  showMoneyDetails,
}: {
  order: OrderSummary;
  returnTo: string;
  measurementFields: MeasurementField[];
  showMoneyDetails: boolean;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);

  return (
    <Panel
      id={`order-${order.order_id}`}
      sx={{
        height: "100%",
        p: { xs: 2, md: 2.5 },
        containerType: "inline-size",
      }}
    >
      <Stack spacing={2.25}>
        <OrderHeader order={order} />
        <OrderItems order={order} showMoneyDetails={showMoneyDetails} />
        <OrderActions
          order={order}
          returnTo={returnTo}
          measurementFields={measurementFields}
          showMoneyDetails={showMoneyDetails}
          paymentOpen={paymentOpen}
          measurementsOpen={measurementsOpen}
          onPaymentOpen={() => setPaymentOpen(true)}
          onPaymentClose={() => setPaymentOpen(false)}
          onMeasurementsOpen={() => setMeasurementsOpen(true)}
          onMeasurementsClose={() => setMeasurementsOpen(false)}
        />
      </Stack>
    </Panel>
  );
}
