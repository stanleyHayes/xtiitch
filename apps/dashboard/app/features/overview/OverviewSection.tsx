import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { Link as RouterLink } from "react-router";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { DashboardMetrics } from "../shell/DashboardMetrics";
import { ManagementOverviewPanel } from "./ManagementOverviewPanel";
import { StoreReadinessPanel } from "./StoreReadinessPanel";
import { TodayFocusPanel } from "./TodayFocusPanel";
import type { MoneySummary, OrderSummary, OverviewRoom, SetupStep } from "../shared/types";

export function OverviewSection({
  liveOrders,
  pendingPayments,
  needsMeasurements,
  activeBookings,
  openHandovers,
  readyForHandover,
  pendingMessages,
  moneySummary,
  overviewRooms,
  setupSteps,
  storefrontURL,
  payoutReady,
  pendingActivation,
}: {
  liveOrders: OrderSummary[];
  pendingPayments: number;
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  readyForHandover: number;
  pendingMessages: number;
  moneySummary: MoneySummary;
  overviewRooms: OverviewRoom[];
  setupSteps: SetupStep[];
  storefrontURL: string;
  payoutReady: boolean;
  pendingActivation: boolean;
}) {
  return (
    <>
      <DashboardMetrics
        canManage
        liveOrders={liveOrders}
        pendingPayments={pendingPayments}
        needsMeasurements={needsMeasurements}
        activeBookings={activeBookings}
        openHandovers={openHandovers}
        readyForHandover={readyForHandover}
        moneySummary={moneySummary}
      />

      <Box sx={{ mt: 2.5 }}>
        <ReportsPanelStub />
      </Box>

      <Box
        sx={{
          mt: 2.5,
          display: "grid",
          gap: { xs: 2.5, xl: 3 },
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.35fr) minmax(320px, 0.65fr)",
          },
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack spacing={2.5}>
            <ManagementOverviewPanel rooms={overviewRooms} />
          </Stack>
        </Box>

        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          {!payoutReady ? (
            <Alert
              severity="warning"
              icon={<PaymentsRounded />}
              action={
                <Button
                  component={RouterLink}
                  to="/dashboard/settings#payouts"
                  color="inherit"
                  size="small"
                  variant="outlined"
                >
                  Set up payouts
                </Button>
              }
            >
              <strong>Add your mobile money number to get paid.</strong> Until
              you do, customers can&apos;t check out — payments to your store
              won&apos;t start.
            </Alert>
          ) : null}
          <StoreReadinessPanel
            steps={setupSteps}
            storefrontURL={storefrontURL}
            pendingActivation={pendingActivation}
          />
          <TodayFocusPanel
            pendingPayments={pendingPayments}
            needsMeasurements={needsMeasurements}
            openHandovers={openHandovers}
            pendingMessages={pendingMessages}
          />
        </Stack>
      </Box>
    </>
  );
}

export function ReportsPanelStub() {
  return null;
}
