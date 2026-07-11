import type { AdminPromotion, AdminBusiness } from "../../lib/api";
import { promotionScopeOptions, promotionStatusOptions } from "./options";
import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
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
import { promotionDiscountLabel, promotionScopeTargetLabel, promotionStatusColor, promotionTargetLabel } from "./utils";
import { AdminPromotionCreateForm } from "./AdminPromotionCreateForm";
import { AdminPromotionDetailForm } from "./AdminPromotionDetailForm";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function PromotionsSection({
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
        <Panel sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(140px, 0.35fr)) auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search promotions"
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
              {promotionStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Scope"
              select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All scopes</MenuItem>
              {promotionScopeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<LocalOfferRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New promotion
            </Button>
          </Box>
        </Panel>
      ) : null}

      {!promotionsError && promotions.length === 0 ? (
        <Alert severity="info">
          No promotion rules are configured yet. Create the first voucher from
          New promotion.
        </Alert>
      ) : null}

      {!promotionsError &&
      promotions.length > 0 &&
      filteredPromotions.length === 0 ? (
        <Alert severity="info">
          No promotions match the current search and filters.
        </Alert>
      ) : null}

      {!promotionsError && filteredPromotions.length > 0 ? (
        <Stack spacing={1.5}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                xl: "repeat(2, minmax(0, 1fr))",
              },
              alignItems: "start",
            }}
          >
            {pagedPromotions.map((promotion) => {
              const archived = promotion.status === "archived";
              const color = promotionStatusColor(promotion.status);

              return (
                <Panel
                  key={promotion.promotionId}
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
                            {promotion.title}
                          </Typography>
                          {promotion.code ? (
                            <Chip size="small" label={promotion.code} />
                          ) : (
                            <Chip size="small" label="Auto code" />
                          )}
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.5, color: "text.secondary" }}
                        >
                          {promotionTargetLabel(promotion)}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={promotion.status}
                        sx={{
                          bgcolor: alpha(color, 0.12),
                          color,
                          fontWeight: 900,
                          textTransform: "capitalize",
                        }}
                      />
                    </Stack>

                    <Box
                      sx={{
                        display: "grid",
                        gap: 1,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, 1fr)",
                        },
                      }}
                    >
                      <DetailLine
                        label="Discount"
                        value={promotionDiscountLabel(promotion)}
                      />
                      <DetailLine
                        label="Cap"
                        value={
                          typeof promotion.maxDiscountMinor === "number"
                            ? formatGHS(promotion.maxDiscountMinor)
                            : "No cap"
                        }
                      />
                      <DetailLine
                        label="Minimum spend"
                        value={formatGHS(promotion.minSpendMinor)}
                      />
                      <DetailLine
                        label="Redemptions"
                        value={`${promotion.redemptionCount} uses · ${formatGHS(
                          promotion.discountRedeemedMinor,
                        )}`}
                      />
                      <DetailLine
                        label="Limits"
                        value={`Global ${
                          promotion.usageLimitGlobal ?? "unlimited"
                        } · Customer ${
                          promotion.usageLimitPerCustomer ?? "unlimited"
                        }`}
                      />
                      <DetailLine
                        label="Funding"
                        value={`${promotion.fundingSource} · ${promotionScopeTargetLabel(
                          promotion,
                        )}`}
                      />
                      <DetailLine
                        label="Starts"
                        value={
                          promotion.startsAt
                            ? shortTime(promotion.startsAt)
                            : "Now"
                        }
                      />
                      <DetailLine
                        label="Ends"
                        value={
                          promotion.endsAt
                            ? shortTime(promotion.endsAt)
                            : "Open"
                        }
                      />
                    </Box>

                    <CardDetailAction
                      onClick={() => setDetailID(promotion.promotionId)}
                      hint={
                        promotion.redemptionCount > 0
                          ? `${promotion.redemptionCount} redemption${
                              promotion.redemptionCount === 1 ? "" : "s"
                            } · ${formatGHS(promotion.discountRedeemedMinor)}`
                          : undefined
                      }
                    />
                  </Stack>
                </Panel>
              );
            })}
          </Box>
          <PaginationFooter
            count={promotionPageCount}
            label="promotions"
            page={promotionPage}
            pageSize={6}
            total={filteredPromotions.length}
            onChange={setPromotionPage}
          />
        </Stack>
      ) : null}

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
