import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import Alert from "@mui/material/Alert";
import { tokens } from "../../../theme";
import { formatGHS } from "../../shared/formatting";
import { shortID, shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import {
  promotionDiscountLabel,
  promotionScopeTargetLabel,
} from "../utils";
import type { AdminPromotion } from "../../../lib/api";

export function PromotionSummary({ promotion }: { promotion: AdminPromotion }) {
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
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
          } · Customer ${promotion.usageLimitPerCustomer ?? "unlimited"}`}
        />
        <DetailLine
          label="Funding"
          value={`${promotion.fundingSource} · ${promotionScopeTargetLabel(
            promotion,
          )}`}
        />
        <DetailLine
          label="Starts"
          value={promotion.startsAt ? shortTime(promotion.startsAt) : "Now"}
        />
        <DetailLine
          label="Ends"
          value={promotion.endsAt ? shortTime(promotion.endsAt) : "Open"}
        />
      </Box>

      {promotion.recentRedemptions.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          }}
        >
          {promotion.recentRedemptions.map((redemption) => (
            <Box
              key={redemption.promotionRedemptionId}
              sx={{
                p: 1.1,
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                borderRadius: 1,
                bgcolor: "rgba(var(--surface-rgb), 0.7)",
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Chip
                  size="small"
                  label={redemption.status}
                  color={
                    redemption.status === "applied"
                      ? "success"
                      : redemption.status === "pending"
                        ? "warning"
                        : "default"
                  }
                  variant="outlined"
                  sx={{ textTransform: "capitalize" }}
                />
                <Typography sx={{ fontWeight: 900 }}>
                  {formatGHS(redemption.discountMinor)}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.75,
                  color: "text.secondary",
                  overflowWrap: "anywhere",
                }}
              >
                {redemption.customerName ||
                  (redemption.customerId
                    ? `Customer ${shortID(redemption.customerId)}`
                    : "Unknown customer")}
                {" · "}
                {redemption.orderId
                  ? `Order ${shortID(redemption.orderId)}`
                  : "No order linked"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
              >
                {shortTime(redemption.redeemedAt ?? redemption.createdAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info">No recent redemptions have been recorded.</Alert>
      )}
    </>
  );
}
