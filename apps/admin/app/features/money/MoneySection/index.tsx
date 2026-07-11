import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import { SectionHeader } from "../../../components/ui";
import { usePagedItems } from "../../shared/usePagedItems";
import type { AdminMoneyRails } from "../../../lib/api";
import { MoneyRailsPanel } from "./MoneyRailsPanel";
import { ReversalPanel } from "./ReversalPanel";

export function MoneySection({
  moneyRails,
  moneyRailsError,
}: {
  moneyRails: AdminMoneyRails | null;
  moneyRailsError: string | null;
}) {
  const moneyWebhookEvents = moneyRails?.webhookEvents ?? [];
  const moneyPayoutReviews = moneyRails?.payoutReviews ?? [];
  const {
    page: webhookPage,
    pageCount: webhookPageCount,
    pagedItems: pagedMoneyWebhookEvents,
    setPage: setWebhookPage,
  } = usePagedItems(moneyWebhookEvents, 6, moneyWebhookEvents.length);
  const {
    page: payoutPage,
    pageCount: payoutPageCount,
    pagedItems: pagedMoneyPayoutReviews,
    setPage: setPayoutPage,
  } = usePagedItems(moneyPayoutReviews, 6, moneyPayoutReviews.length);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Paystack operations"
        title="Money rails"
        helper="Watch webhook delivery, split settlement, subaccount health, and payout holds without touching tenant funds."
      />
      {moneyRailsError ? (
        <Alert severity="warning">{moneyRailsError}</Alert>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "1.08fr 0.92fr" },
        }}
      >
        <MoneyRailsPanel
          events={moneyWebhookEvents}
          pagedEvents={pagedMoneyWebhookEvents}
          page={webhookPage}
          pageCount={webhookPageCount}
          onPageChange={setWebhookPage}
        />
        <ReversalPanel
          reviews={moneyPayoutReviews}
          pagedReviews={pagedMoneyPayoutReviews}
          page={payoutPage}
          pageCount={payoutPageCount}
          onPageChange={setPayoutPage}
        />
      </Box>
    </Stack>
  );
}
