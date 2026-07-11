import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import Alert from "@mui/material/Alert";
import { tokens } from "../../../theme";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { subscriptionStatusColor } from "../../shared/colors";
import {
  billingModeLabel,
  subscriptionStatusLabel,
} from "../utils";
import { subscriptionDesignUsageLabel } from "../../plans/utils";
import type { AdminSubscription } from "../../shared/types";
import { SubscriptionDetail } from "./SubscriptionDetail";

export function SubscriptionList({
  subscriptions,
  lifecycleRows,
  pagedLifecycleRows,
  manageBusinessId,
  setManageBusinessId,
  page,
  pageCount,
  onPageChange,
  onSelectBusinesses,
}: {
  subscriptions: AdminSubscription[];
  lifecycleRows: AdminSubscription[];
  pagedLifecycleRows: AdminSubscription[];
  manageBusinessId: string | null;
  setManageBusinessId: (businessId: string | null) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onSelectBusinesses: () => void;
}) {
  const managedSubscription =
    subscriptions.find(
      (subscription) => subscription.businessId === manageBusinessId,
    ) ?? null;

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 340px" },
          alignItems: "start",
        }}
      >
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="h6">Lifecycle queue</Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  Review billing state, mode, next collection, and operator
                  notes.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                onClick={onSelectBusinesses}
                sx={{ whiteSpace: "nowrap" }}
              >
                Open businesses
              </Button>
            </Stack>
            {lifecycleRows.length === 0 && subscriptions.length > 0 ? (
              <Alert severity="info">
                No subscription lifecycle rows need attention right now; showing
                active records.
              </Alert>
            ) : null}
            {subscriptions.length === 0 ? (
              <Alert severity="info">
                No subscriptions are ready to manage yet.
              </Alert>
            ) : null}
            {pagedLifecycleRows.map((subscription) => {
              const color = subscriptionStatusColor(subscription.status);

              return (
                <Box
                  key={subscription.businessId}
                  sx={{
                    p: { xs: 1.5, md: 2 },
                    border: "1px solid",
                    borderColor: alpha(color, 0.18),
                    borderRadius: 2,
                    bgcolor: "rgba(var(--surface-rgb), 0.82)",
                    backgroundImage: `
                      linear-gradient(90deg, ${alpha(color, 0.08)}, transparent 34%),
                      linear-gradient(180deg, rgba(var(--surface-rgb), 0.96), rgba(var(--surface-rgb), 0.62))
                    `,
                    boxShadow: `0 16px 40px ${alpha(tokens.ink, 0.045)}`,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{
                      alignItems: { sm: "flex-start" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          {subscription.businessName}
                        </Typography>
                        <Chip
                          size="small"
                          label={subscription.planName}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={subscriptionStatusLabel(subscription.status)}
                          sx={{
                            bgcolor: alpha(color, 0.11),
                            color,
                            textTransform: "capitalize",
                          }}
                        />
                        {typeof subscription.designLimit === "number" &&
                        subscription.designCount > subscription.designLimit ? (
                          <Chip
                            size="small"
                            label="Over limit"
                            color="warning"
                            variant="outlined"
                          />
                        ) : null}
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.65, color: "text.secondary" }}
                      >
                        {subscription.handle}.xtiitch.com ·{" "}
                        {formatGHS(subscription.gmvMinor)} GMV ·{" "}
                        {formatGHS(subscription.monthlyFeeMinor)} monthly fee
                      </Typography>
                      <Typography sx={{ mt: 0.75 }}>
                        {billingModeLabel(subscription.billingMode)} billing ·{" "}
                        {subscription.nextBillingAt
                          ? `Next billing ${shortTime(subscription.nextBillingAt)}`
                          : "No scheduled billing date"}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.55,
                          color:
                            typeof subscription.designLimit === "number" &&
                            subscription.designCount > subscription.designLimit
                              ? tokens.warning
                              : "text.secondary",
                        }}
                      >
                        {subscriptionDesignUsageLabel(subscription)}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<SettingsRounded />}
                      onClick={() =>
                        setManageBusinessId(subscription.businessId)
                      }
                      sx={{
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        alignSelf: { xs: "stretch", sm: "flex-start" },
                      }}
                    >
                      Manage billing
                    </Button>
                  </Stack>
                </Box>
              );
            })}
            <PaginationFooter
              count={pageCount}
              label="subscription rows"
              page={page}
              pageSize={4}
              total={lifecycleRows.length}
              onChange={onPageChange}
            />
          </Stack>
        </Panel>
      </Box>

      <Dialog
        open={Boolean(managedSubscription)}
        onClose={() => setManageBusinessId(null)}
        fullWidth
        maxWidth="md"
      >
        {managedSubscription ? (
          <>
            <DialogTitle sx={{ pb: 0.5 }}>
              <Typography
                component="span"
                sx={{ display: "block", fontWeight: 900, fontSize: 18 }}
              >
                {managedSubscription.businessName}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                {managedSubscription.planName} ·{" "}
                {billingModeLabel(managedSubscription.billingMode)} billing ·{" "}
                {managedSubscription.handle}.xtiitch.com
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <SubscriptionDetail
                subscription={managedSubscription}
                openInvoice={managedSubscription.invoices.find(
                  (invoice) => invoice.status === "issued",
                )}
                latestInvoice={managedSubscription.invoices[0]}
                canIssueInvoice={
                  managedSubscription.monthlyFeeMinor > 0 &&
                  managedSubscription.status !== "canceled" &&
                  !managedSubscription.invoices.find(
                    (invoice) => invoice.status === "issued",
                  )
                }
                canCaptureAuthorization={
                  managedSubscription.monthlyFeeMinor > 0 &&
                  managedSubscription.status !== "canceled"
                }
              />
            </DialogContent>
          </>
        ) : null}
      </Dialog>
    </>
  );
}
