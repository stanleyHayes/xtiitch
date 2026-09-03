import type {
  AdminAffiliate,
  AdminAffiliateApplication,
  AdminAffiliateAttribution,
  AdminAffiliateProgramme,
  AdminGrowthReport,
} from "../../../lib/api";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import TextField from "../../../components/form-text-field";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { AdminActionFeedback } from "../../shared/types";
import { formatGHS } from "../../shared/formatting";
import { MetricCard } from "../../../components/ui/MetricCard";
import { usePagedItems } from "../../shared/usePagedItems";
import { useActionSuccess } from "../../shared/useActionSuccess";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { AdminAffiliateDetailForm } from "../AdminAffiliateDetailForm";
import { AffiliateTable } from "./AffiliateTable";
import { AffiliateApplicationsPanel } from "./AffiliateApplicationsPanel";
import { AffiliateProgrammesPanel } from "./AffiliateProgrammesPanel";
import { GrowthReportPanel } from "./GrowthReportPanel";

// eslint-disable-next-line max-lines-per-function -- large presentational component; refactor in follow-up
export function AffiliatesSection({
  affiliates,
  affiliatesError,
  programmes,
  programmesError,
  applications,
  applicationsError,
  affiliateAttribution,
  affiliateAttributionError,
  growthReport,
  growthReportError,
  actionData,
}: {
  affiliates: AdminAffiliate[];
  affiliatesError: string | null;
  programmes: AdminAffiliateProgramme[];
  programmesError: string | null;
  applications: AdminAffiliateApplication[];
  applicationsError: string | null;
  affiliateAttribution: AdminAffiliateAttribution[];
  affiliateAttributionError: string | null;
  growthReport: AdminGrowthReport;
  growthReportError: string | null;
  actionData?: AdminActionFeedback;
}) {
  const [detailID, setDetailID] = useState<string | null>(null);
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [affiliateStatus, setAffiliateStatus] = useState("all");

  // §1.2/§11.4: the affiliate dialog closes on any successful affiliates
  // action (create, conversion, payout, edit, archive); errors stay open.
  const actionSuccess = useActionSuccess("affiliates");
  useEffect(() => {
    if (actionSuccess) {
      setDetailID(null);
    }
  }, [actionSuccess]);

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
  const filteredAffiliates = affiliates.filter((affiliate) => {
    const query = affiliateSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [
        affiliate.displayName,
        affiliate.contactName,
        affiliate.email,
        affiliate.phone,
        affiliate.code,
      ].some((value) => value.toLowerCase().includes(query));
    return (
      matchesQuery &&
      (affiliateStatus === "all" || affiliate.status === affiliateStatus)
    );
  });
  const {
    page: affiliatePage,
    pageCount: affiliatePageCount,
    pagedItems: pagedAffiliates,
    setPage: setAffiliatePage,
  } = usePagedItems(filteredAffiliates, 4, filteredAffiliates.length);
  const selectedAffiliate =
    affiliates.find((affiliate) => affiliate.affiliateId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Affiliate programmes"
        helper="Register Affiliates and agents, track codes, commission terms, cookie windows, payout rail readiness, and approval state."
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

      <AffiliateApplicationsPanel
        applications={applications}
        error={applicationsError}
      />
      <AffiliateProgrammesPanel
        programmes={programmes}
        error={programmesError}
      />
      <GrowthReportPanel report={growthReport} error={growthReportError} />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Active Affiliates"
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
          helper="Disabled Affiliate links"
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

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
        }}
      >
        <TextField
          label="Search Affiliates"
          value={affiliateSearch}
          onChange={(event) => setAffiliateSearch(event.target.value)}
          placeholder="Name, code, email, or WhatsApp"
        />
        <TextField
          select
          label="Status"
          value={affiliateStatus}
          onChange={(event) => setAffiliateStatus(event.target.value)}
        >
          <MenuItem value="all">All statuses</MenuItem>
          <MenuItem value="pending_review">Pending review</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="paused">Paused</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </TextField>
      </Box>

      <AffiliateTable
        affiliates={filteredAffiliates}
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
              affiliates={affiliates}
              milestones={
                programmes.find(
                  (programme) =>
                    programme.affiliateProgrammeId ===
                    selectedAffiliate.affiliateProgrammeId,
                )?.milestones ?? []
              }
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
