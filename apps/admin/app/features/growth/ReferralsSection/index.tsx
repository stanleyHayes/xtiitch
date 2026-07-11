import type { AdminReferralProgramme, AdminBusiness } from "../../../lib/api";
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
import { MetricCard } from "../../../components/ui/MetricCard";
import { usePagedItems } from "../../shared/usePagedItems";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { AdminReferralProgrammeDetailForm } from "../AdminReferralProgrammeDetailForm";
import { ReferralProgrammeTable } from "./ReferralProgrammeTable";

export function ReferralsSection({
  programmes,
  referralProgrammesError,
  businesses,
  actionData,
}: {
  programmes: AdminReferralProgramme[];
  referralProgrammesError: string | null;
  businesses: AdminBusiness[];
  actionData?: AdminActionFeedback;
}) {
  const [detailID, setDetailID] = useState<string | null>(null);
  const activeProgrammes = programmes.filter(
    (programme) => programme.status === "active",
  );
  const draftProgrammes = programmes.filter(
    (programme) => programme.status === "draft",
  );
  const pausedProgrammes = programmes.filter(
    (programme) => programme.status === "paused",
  );
  const archivedProgrammes = programmes.filter(
    (programme) => programme.status === "archived",
  );
  const issuedCodeCount = programmes.reduce(
    (total, programme) => total + programme.codes.length,
    0,
  );
  const {
    page: referralPage,
    pageCount: referralPageCount,
    pagedItems: pagedProgrammes,
    setPage: setReferralPage,
  } = usePagedItems(programmes, 4, programmes.length);
  const selectedProgramme =
    programmes.find((programme) => programme.programmeId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Referral programmes"
        helper="Create two-sided referral programmes, control reward economics, qualifying order minimums, payout holds, date windows, and lifecycle state."
      />

      {actionData?.section === "referrals" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {referralProgrammesError ? (
        <Alert severity="warning">{referralProgrammesError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Active programmes"
          value={String(activeProgrammes.length)}
          helper="Eligible for referral links"
          trend={`${programmes.length} total`}
        />
        <MetricCard
          label="Draft"
          value={String(draftProgrammes.length)}
          helper="Not visible to customers"
          trend="Setup queue"
        />
        <MetricCard
          label="Paused"
          value={String(pausedProgrammes.length)}
          helper="Temporarily disabled"
          trend="No new rewards"
        />
        <MetricCard
          label="Issued codes"
          value={String(issuedCodeCount)}
          helper="Latest codes loaded"
          trend={`${archivedProgrammes.length} archived`}
        />
      </Box>

      <ReferralProgrammeTable
        programmes={programmes}
        pagedProgrammes={pagedProgrammes}
        page={referralPage}
        pageCount={referralPageCount}
        onPageChange={setReferralPage}
        onSelect={setDetailID}
        referralProgrammesError={referralProgrammesError}
      />

      <Dialog
        open={Boolean(selectedProgramme)}
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
                {selectedProgramme?.title ?? "Referral programme"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Issue codes, edit reward economics, or archive.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedProgramme ? (
            <AdminReferralProgrammeDetailForm
              programme={selectedProgramme}
              eligibleBusinesses={businesses.filter(
                (business) =>
                  business.verificationStatus === "verified" &&
                  business.operationalStatus === "active",
              )}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
