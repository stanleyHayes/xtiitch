import type { AdminPromotion, AdminBusiness } from "../../../lib/api";
import { useEffect, useMemo, useState } from "react";
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
import { useActionSuccess } from "../../shared/useActionSuccess";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { AdminPromotionCreateForm } from "../AdminPromotionCreateForm";
import { AdminPromotionDetailForm } from "../AdminPromotionDetailForm";
import { promotionDiscountLabel, promotionScopeTargetLabel, promotionTargetLabel } from "../utils";
import { PromotionActions } from "./PromotionActions";
import { PromotionTable } from "./PromotionTable";

export function PromotionsSection({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  promotions,
  promotionsError,
  businesses,
  actionData,
}: {
  promotions: AdminPromotion[];
  promotionsError: string | null;
  businesses: AdminBusiness[];
  actionData?: AdminActionFeedback;
}) {
  const activePromotions = promotions.filter(
    (promotion) => promotion.status === "active",
  );
  const platformWidePromotions = promotions.filter(
    (promotion) => !promotion.businessId,
  );
  const targetedPromotions = promotions.filter(
    (promotion) => promotion.businessId,
  );
  const redeemedMinor = promotions.reduce(
    (total, promotion) => total + promotion.discountRedeemedMinor,
    0,
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);

  // §1.2/§11.4: both dialogs close on any successful promotions action
  // (create, edit, archive); errors stay open with the input intact.
  const actionSuccess = useActionSuccess("promotions");
  useEffect(() => {
    if (actionSuccess) {
      setCreateOpen(false);
      setDetailID(null);
    }
  }, [actionSuccess]);

  const filteredPromotions = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return promotions.filter((promotion) => {
      const matchesStatus =
        statusFilter === "all" || promotion.status === statusFilter;
      const matchesScope =
        scopeFilter === "all" || promotion.scope === scopeFilter;
      const searchable = [
        promotion.title,
        promotion.code,
        promotion.status,
        promotion.scope,
        promotion.fundingSource,
        promotionTargetLabel(promotion),
        promotionDiscountLabel(promotion),
        promotionScopeTargetLabel(promotion),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesScope &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [promotions, query, scopeFilter, statusFilter]);
  const {
    page: promotionPage,
    pageCount: promotionPageCount,
    pagedItems: pagedPromotions,
    setPage: setPromotionPage,
  } = usePagedItems(
    filteredPromotions,
    6,
    `${query}:${statusFilter}:${scopeFilter}`,
  );
  const selectedPromotion =
    promotions.find((promotion) => promotion.promotionId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Promotions"
        helper="Voucher rules, funding ownership, redemption caps, and business-targeted offers."
      />

      {actionData?.section === "promotions" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {promotionsError ? (
        <Alert severity="warning">{promotionsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MetricCard
          label="Active offers"
          value={String(activePromotions.length)}
          helper={`${promotions.length} total promotion rules`}
          trend="Live"
        />
        <MetricCard
          label="Platform-wide"
          value={String(platformWidePromotions.length)}
          helper="Global voucher coverage"
          trend="All stores"
        />
        <MetricCard
          label="Targeted stores"
          value={String(targetedPromotions.length)}
          helper="Business-specific offers"
          trend={`${businesses.length} tenants`}
        />
        <MetricCard
          label="Redeemed discount"
          value={formatGHS(redeemedMinor)}
          helper="Recorded voucher value"
          trend={`${promotions.reduce((total, promotion) => total + promotion.redemptionCount, 0)} uses`}
        />
      </Box>

      {!promotionsError ? (
        <PromotionActions
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          scopeFilter={scopeFilter}
          onScopeFilterChange={setScopeFilter}
          onCreate={() => setCreateOpen(true)}
        />
      ) : null}

      <PromotionTable
        promotions={promotions}
        filteredPromotions={filteredPromotions}
        pagedPromotions={pagedPromotions}
        page={promotionPage}
        pageCount={promotionPageCount}
        onPageChange={setPromotionPage}
        onSelect={setDetailID}
      />

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create promotion</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Add a platform-wide voucher or tie the offer to one store.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <AdminPromotionCreateForm businesses={businesses} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedPromotion)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">
                {selectedPromotion?.title ?? "Promotion details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Review redemptions, edit rules, or archive this promotion.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPromotion ? (
            <AdminPromotionDetailForm
              promotion={selectedPromotion}
              businesses={businesses}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
