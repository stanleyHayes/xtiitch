import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { AdminPromotion } from "../../../lib/api";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import { CardDetailAction } from "../../shared/CardDetailAction";
import {
  promotionDiscountLabel,
  promotionScopeTargetLabel,
  promotionStatusColor,
  promotionTargetLabel,
} from "../utils";

export function PromotionTable({
  promotions,
  filteredPromotions,
  pagedPromotions,
  page,
  pageCount,
  onPageChange,
  onSelect,
}: {
  promotions: AdminPromotion[];
  filteredPromotions: AdminPromotion[];
  pagedPromotions: AdminPromotion[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onSelect: (promotionId: string) => void;
}) {
  return (
    <>
      {!promotions.length ? (
        <Alert severity="info">
          No promotion rules are configured yet. Create the first voucher from
          New promotion.
        </Alert>
      ) : null}

      {promotions.length > 0 && filteredPromotions.length === 0 ? (
        <Alert severity="info">
          No promotions match the current search and filters.
        </Alert>
      ) : null}

      {filteredPromotions.length > 0 ? (
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
                      onClick={() => onSelect(promotion.promotionId)}
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
            count={pageCount}
            label="promotions"
            page={page}
            pageSize={6}
            total={filteredPromotions.length}
            onChange={onPageChange}
          />
        </Stack>
      ) : null}
    </>
  );
}
