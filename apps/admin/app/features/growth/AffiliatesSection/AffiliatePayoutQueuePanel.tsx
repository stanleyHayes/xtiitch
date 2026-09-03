import { Form } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
  AdminAffiliatePayout,
} from "../../../lib/api";
import TextField from "../../../components/form-text-field";
import { Panel } from "../../../components/ui/Panel";
import { formatGHS } from "../../shared/formatting";
import { shortID, shortTime } from "../../shared/dates";

const HISTORY_SIZE = 8;

type PayableAffiliate = {
  affiliateId: string;
  displayName: string;
  code: string;
  availableMinor: number;
  payoutMode: AdminAffiliate["payoutMode"];
  payoutReference: string;
};

type PayoutHistoryEntry = AdminAffiliatePayout & { affiliateCode: string };

// A Paystack-transfer Affiliate cannot be paid without a recipient on file, so
// say so on the row rather than letting the operator discover it at Paystack.
function payoutReadiness(affiliate: PayableAffiliate): string {
  if (affiliate.payoutMode === "paystack_transfer" && !affiliate.payoutReference) {
    return "No Paystack recipient on file";
  }
  if (affiliate.payoutMode === "paystack_transfer") {
    return `Paystack recipient ${affiliate.payoutReference}`;
  }
  return "Manual payout";
}

function PayableRow({
  affiliate,
  open,
  onToggle,
}: {
  affiliate: PayableAffiliate;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Stack
      spacing={1}
      sx={{ p: 1, borderRadius: 1, bgcolor: "rgba(var(--surface-rgb), 0.76)" }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }}>
            {affiliate.displayName} · {formatGHS(affiliate.availableMinor)}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {affiliate.code} · {payoutReadiness(affiliate)}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={onToggle}>
          {open ? "Cancel" : "Record payout"}
        </Button>
      </Stack>

      {open ? (
        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value="admin-affiliate-payout:create"
          />
          <input
            type="hidden"
            name="affiliate_id"
            value={affiliate.affiliateId}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              label="Payout reference"
              name="payout_reference"
              placeholder="TRF_..."
              sx={{ minWidth: 180 }}
            />
            <TextField
              size="small"
              label="Notes"
              name="notes"
              defaultValue="Settled from available affiliate commission."
              sx={{ flex: 1 }}
            />
            <Button type="submit" size="small" variant="contained">
              Record
            </Button>
          </Stack>
        </Form>
      ) : null}
    </Stack>
  );
}

export function AffiliatePayoutQueuePanel({
  affiliates,
  affiliateAttribution,
}: {
  affiliates: AdminAffiliate[];
  affiliateAttribution: AdminAffiliateAttribution[];
}) {
  const [recording, setRecording] = useState<string | null>(null);

  const payable: PayableAffiliate[] = affiliateAttribution
    .flatMap((item) => {
      const affiliate = affiliates.find(
        (candidate) => candidate.affiliateId === item.affiliateId,
      );
      // Archived Affiliates keep their history but are not paid again.
      if (!affiliate || affiliate.status === "archived") return [];
      if (item.availableCommissionMinor <= 0) return [];
      return [
        {
          affiliateId: item.affiliateId,
          displayName: item.displayName,
          code: item.code,
          availableMinor: item.availableCommissionMinor,
          payoutMode: affiliate.payoutMode,
          payoutReference: affiliate.payoutReference,
        },
      ];
    })
    .sort((left, right) => right.availableMinor - left.availableMinor);

  const history: PayoutHistoryEntry[] = affiliateAttribution
    .flatMap((item) =>
      item.recentPayouts.map((payout) => ({
        ...payout,
        affiliateCode: item.code,
      })),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, HISTORY_SIZE);

  const payableTotal = payable.reduce(
    (total, item) => total + item.availableMinor,
    0,
  );

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
      }}
    >
      <Panel sx={{ p: 2.5 }}>
        <Typography variant="overline">Payout administration</Typography>
        <Typography variant="h6">
          Available balances · {formatGHS(payableTotal)}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Affiliates with matured commission and no hold in the way. Recording a
          payout settles the underlying commissions and links them to the batch.
        </Typography>
        {payable.length ? (
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {payable.map((affiliate) => (
              <PayableRow
                key={affiliate.affiliateId}
                affiliate={affiliate}
                open={recording === affiliate.affiliateId}
                onToggle={() =>
                  setRecording(
                    recording === affiliate.affiliateId
                      ? null
                      : affiliate.affiliateId,
                  )
                }
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
            Nothing is payable right now. Commission appears here once it
            matures and any hold is released.
          </Typography>
        )}
      </Panel>

      <Panel sx={{ p: 2.5 }}>
        <Typography variant="overline">Payout administration</Typography>
        <Typography variant="h6">Payout history</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Every batch keeps its commission rows. Adjustments net off future
          payouts rather than rewriting a settled one.
        </Typography>
        {history.length ? (
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {history.map((payout) => (
              <Stack
                key={payout.payoutBatchId}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: "rgba(var(--surface-rgb), 0.76)",
                  justifyContent: "space-between",
                  alignItems: { sm: "center" },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>
                    {payout.displayName} · {formatGHS(payout.commissionMinor)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                  >
                    {payout.affiliateCode} ·{" "}
                    {payout.payoutReference || shortID(payout.payoutBatchId)} ·{" "}
                    {payout.conversionCount} commissions ·{" "}
                    {shortTime(payout.createdAt)}
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" label={payout.status} />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
            No payouts recorded yet.
          </Typography>
        )}
      </Panel>
    </Box>
  );
}
