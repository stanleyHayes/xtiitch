import { useMemo } from "react";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PriceCheckRounded from "@mui/icons-material/PriceCheckRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TextField from "../../components/form-text-field";
import type { Design } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { BusinessPromotion, CollectionSummary } from "../shared/types";
import { useCloseOnSuccess } from "../settings/useCloseOnSuccess";
import { promotionDiscountLabel, promotionTargetLabel } from "./utils";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { MiniStat } from "../../components/ui/MiniStat";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { PromotionRow } from "./PromotionRow";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { PromotionCreateForm } from "./PromotionCreateForm";
import { PromotionDetailForm } from "./PromotionDetailForm";

export function PromotionPanel({
  promotions,
  collections,
  designs,
  activeCount,
  redeemedMinor,
  error,
}: {
  promotions: BusinessPromotion[];
  collections: CollectionSummary[];
  designs: Design[];
  activeCount: number;
  redeemedMinor: number;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  useCloseOnSuccess(setCreateOpen, "create_promotion", Boolean(error));
  const [detailID, setDetailID] = useState<string | null>(null);
  const pausedCount = promotions.filter(
    (promotion) => promotion.status === "paused",
  ).length;
  const redemptionCount = promotions.reduce(
    (total, promotion) => total + promotion.redemption_count,
    0,
  );
  const activeCollections = collections.filter(
    (collection) => collection.status === "active",
  );
  const activeDesigns = designs.filter((design) => design.status === "active");
  const filteredPromotions = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return promotions.filter((promotion) => {
      const matchesStatus =
        statusFilter === "all" || promotion.status === statusFilter;
      const matchesScope =
        scopeFilter === "all" || promotion.scope === scopeFilter;
      const searchable = [
        promotion.code,
        promotion.title,
        promotion.description,
        promotion.status,
        promotion.scope,
        promotionDiscountLabel(promotion),
        promotionTargetLabel(promotion, collections, designs),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesScope &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [collections, designs, promotions, query, scopeFilter, statusFilter]);
  const {
    page: promotionPage,
    pageCount: promotionPageCount,
    pagedItems: pagedPromotions,
    setPage: setPromotionPage,
  } = usePagedItems(
    filteredPromotions,
    8,
    `${query}:${statusFilter}:${scopeFilter}`,
  );
  const selectedPromotion =
    promotions.find((promotion) => promotion.promotion_id === detailID) ?? null;

  return (
    <Panel id="promotions">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <LocalOfferRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Promotion desk</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Business-funded codes for store, collection, or design pushes.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${activeCount} active`}
            tone={activeCount > 0 ? tokens.success : tokens.warning}
          />
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              xl: "repeat(4, 1fr)",
            },
          }}
        >
          <MiniStat
            icon={<LocalOfferRounded fontSize="small" />}
            label="Active"
            value={String(activeCount)}
            helper={`${promotions.length} total codes`}
            tone={tokens.success}
          />
          <MiniStat
            icon={<ScheduleRounded fontSize="small" />}
            label="Paused"
            value={String(pausedCount)}
            helper="Saved but not redeemable"
            tone={tokens.warning}
          />
          <MiniStat
            icon={<PriceCheckRounded fontSize="small" />}
            label="Redemptions"
            value={String(redemptionCount)}
            helper="Applied checkout discounts"
            tone={tokens.info}
          />
          <MiniStat
            icon={<PaymentsRounded fontSize="small" />}
            label="Discounted"
            value={formatGHS(redeemedMinor)}
            helper="Business-funded value"
            tone={tokens.burgundy}
          />
        </Box>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box
          sx={{
            mt: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "rgba(var(--surface-rgb), 0.72)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(150px, 0.38fr)) auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search codes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Status"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
            <TextField
              label="Scope"
              select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All scopes</MenuItem>
              <MenuItem value="store">Store</MenuItem>
              <MenuItem value="collection">Collection</MenuItem>
              <MenuItem value="design">Design</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New promotion
            </Button>
          </Box>
          <Divider />
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Promotion list</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {filteredPromotions.length} of {promotions.length} codes shown
              </Typography>
            </Box>
            <ToneChip
              label={`${redemptionCount} used`}
              tone={redemptionCount > 0 ? tokens.success : tokens.info}
            />
          </Box>
          {promotions.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<LocalOfferRounded sx={{ fontSize: 38 }} />}
                title="No promotions yet"
                helper="Create the first promo code when a business wants to fund a store or design push."
              />
            </Box>
          ) : filteredPromotions.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<SearchRounded sx={{ fontSize: 38 }} />}
                title="No matching promotions"
                helper="Adjust the search or filters to bring more codes back into view."
              />
            </Box>
          ) : (
            <>
              {pagedPromotions.map((promotion) => (
                <PromotionRow
                  key={promotion.promotion_id}
                  promotion={promotion}
                  collections={collections}
                  designs={designs}
                  onView={() => setDetailID(promotion.promotion_id)}
                />
              ))}
              <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
                <PaginationFooter
                  count={promotionPageCount}
                  label="promotions"
                  page={promotionPage}
                  total={filteredPromotions.length}
                  onChange={setPromotionPage}
                />
              </Box>
            </>
          )}
        </Box>
      </Box>
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
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
                Launch a storewide or targeted offer.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <PromotionCreateForm
            activeCollections={activeCollections}
            activeDesigns={activeDesigns}
          />
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
                {selectedPromotion?.code ?? "Promotion details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Review, edit, or archive this promotion.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPromotion ? (
            <PromotionDetailForm
              promotion={selectedPromotion}
              collections={collections}
              designs={designs}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}