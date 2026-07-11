import type { AdminAffiliate, AdminAffiliateAttribution } from "../../lib/api";
import { affiliateEntityOptions, affiliateCommissionOptions, affiliatePayoutOptions, affiliateStatusOptions } from "./options";
import { Form } from "react-router";
import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import TextField from "../../components/form-text-field";
import { AdminActionFeedback } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import { DetailLine } from "../shared/DetailLine";
import { CardDetailAction } from "../shared/CardDetailAction";
import { affiliateCommissionLabel, affiliateEntityLabel, affiliatePayoutLabel, affiliateStatusColor, affiliateStatusLabel } from "./utils";
import { FormGroupLabel } from "../shared/FormGroupLabel";
import { AdminAffiliateDetailForm } from "./AdminAffiliateDetailForm";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function AffiliatesSection({
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
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
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
  const attributionByAffiliate = useMemo(
    () =>
      new Map(
        affiliateAttribution.map((item) => [item.affiliateId, item] as const),
      ),
    [affiliateAttribution],
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

      {!affiliatesError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Register affiliate</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Add a partner code and the commercial terms operators approve.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => setAffiliateDialogOpen(true)}
            >
              New affiliate
            </Button>
          </Stack>
          <Dialog
            open={affiliateDialogOpen}
            onClose={() => setAffiliateDialogOpen(false)}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle sx={{ pb: 0.5 }}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    component="span"
                    sx={{ display: "block", fontWeight: 950 }}
                  >
                    Register affiliate partner
                  </Typography>
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ display: "block", color: "text.secondary" }}
                  >
                    Add partner identity, commission terms, and payout details.
                  </Typography>
                </Box>
                <IconButton
                  aria-label="Close"
                  onClick={() => setAffiliateDialogOpen(false)}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-affiliate:create"
                />
                <Stack spacing={2}>
                  <FormGroupLabel>Affiliate</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                    }}
                  >
                    <TextField
                      select
                      label="Entity"
                      name="entity_type"
                      defaultValue="person"
                    >
                      {affiliateEntityOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Code"
                      name="code"
                      required
                      placeholder="SEWINGPRO"
                    />
                    <TextField
                      label="Display name"
                      name="display_name"
                      required
                    />
                    <TextField label="Contact name" name="contact_name" />
                    <TextField label="Email" name="email" type="email" />
                    <TextField label="Phone" name="phone" />
                    <TextField label="Website" name="website_url" type="url" />
                  </Box>
                  <FormGroupLabel>Commission &amp; payout</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                    }}
                  >
                    <TextField
                      select
                      label="Commission"
                      name="commission_model"
                      defaultValue="percentage"
                    >
                      {affiliateCommissionOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Commission value"
                      name="commission_value"
                      type="number"
                      required
                      slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    />
                    <TextField
                      label="Cookie window"
                      name="cookie_window_days"
                      type="number"
                      defaultValue={30}
                      slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }}
                    />
                    <TextField
                      select
                      label="Payout mode"
                      name="payout_mode"
                      defaultValue="voucher"
                    >
                      {affiliatePayoutOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Status"
                      name="status"
                      defaultValue="pending_review"
                    >
                      {affiliateStatusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    }}
                  >
                    <TextField
                      label="Payout reference"
                      name="payout_reference"
                    />
                    <TextField
                      label="Notes"
                      name="notes"
                      multiline
                      minRows={2}
                    />
                  </Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => setAffiliateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained">
                      Create partner
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            </DialogContent>
          </Dialog>
        </Panel>
      ) : null}

      {!affiliatesError && affiliates.length === 0 ? (
        <Alert severity="info">No affiliate partners are registered yet.</Alert>
      ) : null}

      {!affiliatesError && affiliates.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {pagedAffiliates.map((affiliate) => {
            const color = affiliateStatusColor(affiliate.status);
            const archived = affiliate.status === "archived";
            const performance = attributionByAffiliate.get(
              affiliate.affiliateId,
            );
            const approvedConversionCount =
              performance?.approvedConversionCount ?? 0;
            const recentApprovedCommissionMinor =
              performance?.recentConversions
                .filter((conversion) => conversion.status === "approved")
                .reduce(
                  (total, conversion) => total + conversion.commissionMinor,
                  0,
                ) ?? 0;
            const lastPayout = performance?.recentPayouts[0];
            return (
              <Panel
                key={affiliate.affiliateId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(color, archived ? 0.12 : 0.2),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    color,
                    archived ? 0.035 : 0.075,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "flex-start" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">
                          {affiliate.displayName}
                        </Typography>
                        <Chip
                          size="small"
                          label={affiliate.code}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {affiliateEntityLabel(affiliate.entityType)} ·{" "}
                        {affiliate.contactName || "No contact"}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={affiliateStatusLabel(affiliate.status)}
                      sx={{
                        bgcolor: alpha(color, 0.12),
                        color,
                        fontWeight: 900,
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    }}
                  >
                    <DetailLine
                      label="Commission"
                      value={affiliateCommissionLabel(affiliate)}
                    />
                    <DetailLine
                      label="Cookie window"
                      value={`${affiliate.cookieWindowDays} days`}
                    />
                    <DetailLine
                      label="Payout mode"
                      value={affiliatePayoutLabel(affiliate.payoutMode)}
                    />
                    <DetailLine
                      label="Contact"
                      value={affiliate.email || affiliate.phone || "No contact"}
                    />
                    <DetailLine
                      label="Tracked clicks"
                      value={String(performance?.clickCount ?? 0)}
                    />
                    <DetailLine
                      label="Conversions"
                      value={`${performance?.conversionCount ?? 0} total · ${
                        performance?.pendingConversionCount ?? 0
                      } pending`}
                    />
                    <DetailLine
                      label="Gross attributed"
                      value={formatGHS(performance?.grossMinor ?? 0)}
                    />
                    <DetailLine
                      label="Commission"
                      value={formatGHS(performance?.commissionMinor ?? 0)}
                    />
                    <DetailLine
                      label="Approved"
                      value={`${approvedConversionCount} · ${formatGHS(
                        recentApprovedCommissionMinor,
                      )}`}
                    />
                    <DetailLine
                      label="Last payout"
                      value={
                        lastPayout
                          ? `${formatGHS(lastPayout.commissionMinor)} · ${shortTime(
                              lastPayout.createdAt,
                            )}`
                          : "None"
                      }
                    />
                  </Box>

                  <CardDetailAction
                    onClick={() => setDetailID(affiliate.affiliateId)}
                    hint={
                      approvedConversionCount > 0 && !archived
                        ? `${formatGHS(
                            recentApprovedCommissionMinor,
                          )} ready to reconcile`
                        : undefined
                    }
                  />
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}
      {!affiliatesError && affiliates.length > 0 ? (
        <PaginationFooter
          count={affiliatePageCount}
          label="affiliate partners"
          page={affiliatePage}
          pageSize={4}
          total={affiliates.length}
          onChange={setAffiliatePage}
        />
      ) : null}

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
              performance={attributionByAffiliate.get(
                selectedAffiliate.affiliateId,
              )}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
