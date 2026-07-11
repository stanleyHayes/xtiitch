import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
} from "../../../lib/api";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { AdminActionFeedback } from "../../shared/types";
import { formatGHS } from "../../shared/formatting";
import { MetricCard } from "../../../components/ui/MetricCard";
import { usePagedItems } from "../../shared/usePagedItems";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { AdminAffiliateDetailForm } from "../AdminAffiliateDetailForm";
import { AffiliateTable } from "./AffiliateTable";

export function AffiliatesSection({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  affiliates,
  affiliatesError,
  affiliateAttribution,
  affiliateAttributionError,
  actionData,
}: {
  affiliates: AdminAffiliate[];
  affiliatesError: string | null;
  affiliateAttribution: AdminAffiliateAttribution[];
  affiliateAttributionError: string | null;
  actionData?: AdminActionFeedback;
}) {
  const [detailID, setDetailID] = useState<string | null>(null);
  const pendingAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "pending_review",
  );
  const activeAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "active",
  );
  const archivedAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "archived",
  );
  const totalClicks = affiliateAttribution.reduce(
    (total, item) => total + item.clickCount,
    0,
  );
  const totalConversions = affiliateAttribution.reduce(
    (total, item) => total + item.conversionCount,
    0,
  );
  const pendingCommissionMinor = affiliateAttribution.reduce(
    (total, item) =>
      total +
      item.recentConversions
        .filter((conversion) => conversion.status === "pending")
        .reduce(
          (subtotal, conversion) => subtotal + conversion.commissionMinor,
          0,
        ),
    0,
  );
  const approvedCommissionMinor = affiliateAttribution.reduce(
    (total, item) =>
      total +
      item.recentConversions
        .filter((conversion) => conversion.status === "approved")
        .reduce(
          (subtotal, conversion) => subtotal + conversion.commissionMinor,
          0,
        ),
    0,
  );
  const reconciledCommissionMinor = affiliateAttribution.reduce(
    (total, item) =>
      total +
      item.recentPayouts.reduce(
        (subtotal, payout) => subtotal + payout.commissionMinor,
        0,
      ),
    0,
  );
  const {
    page: affiliatePage,
    pageCount: affiliatePageCount,
    pagedItems: pagedAffiliates,
    setPage: setAffiliatePage,
  } = usePagedItems(affiliates, 4, affiliates.length);
  const selectedAffiliate =
    affiliates.find((affiliate) => affiliate.affiliateId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Affiliate programmes"
        helper="Register partners and agents, track codes, commission terms, cookie windows, payout rail readiness, and approval state."
      />

      {actionData?.section === "affiliates" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {affiliatesError ? (
        <Alert severity="warning">{affiliatesError}</Alert>
      ) : null}
      {affiliateAttributionError ? (
        <Alert severity="warning">{affiliateAttributionError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Active partners"
          value={String(activeAffiliates.length)}
          helper="Eligible for attribution"
          trend={`${affiliates.length} total`}
        />
        <MetricCard
          label="Pending review"
          value={String(pendingAffiliates.length)}
          helper="Needs operator approval"
          trend="KYC/payout check"
        />
        <MetricCard
          label="Archived"
          value={String(archivedAffiliates.length)}
          helper="Disabled partner links"
          trend="Audit retained"
        />
        <MetricCard
          label="Paystack ready"
          value={String(
            affiliates.filter((affiliate) =>
              affiliate.payoutMode.startsWith("paystack"),
            ).length,
          )}
          helper="Split or transfer mode"
          trend="No held funds"
        />
        <MetricCard
          label="Tracked clicks"
          value={String(totalClicks)}
          helper="Recorded affiliate visits"
          trend={`${totalConversions} conversions`}
        />
        <MetricCard
          label="Pending commission"
          value={formatGHS(pendingCommissionMinor)}
          helper="Recent pending rows"
          trend="Awaiting approval"
        />
        <MetricCard
          label="Approved commission"
          value={formatGHS(approvedCommissionMinor)}
          helper="Recent approved rows"
          trend="Ready to reconcile"
        />
        <MetricCard
          label="Reconciled payouts"
          value={formatGHS(reconciledCommissionMinor)}
          helper="Recent payout batches"
          trend="Settled from commission"
        />
      </Box>

      <AffiliateTable
        affiliates={affiliates}
        pagedAffiliates={pagedAffiliates}
        affiliateAttribution={affiliateAttribution}
        page={affiliatePage}
        pageCount={affiliatePageCount}
        onPageChange={setAffiliatePage}
        onSelect={setDetailID}
        affiliatesError={affiliatesError}
      />

      <Dialog
        open={Boolean(selectedAffiliate)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">
                {selectedAffiliate?.displayName ?? "Affiliate details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Review conversions and payouts, edit terms, or archive.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedAffiliate ? (
            <AdminAffiliateDetailForm
              affiliate={selectedAffiliate}
              performance={affiliateAttribution.find(
                (item) => item.affiliateId === selectedAffiliate.affiliateId,
              )}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
