import Box from "@mui/material/Box";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import {
  affiliateCommissionLabel,
  affiliatePayoutLabel,
} from "../utils";
import type { AdminAffiliate, AdminAffiliateAttribution } from "../../../lib/api";

export function AffiliateSummary({
  affiliate,
  performance,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
}) {
  const approvedConversionCount = performance?.approvedConversionCount ?? 0;
  const recentApprovedCommissionMinor =
    performance?.recentConversions
      .filter((conversion) => conversion.status === "approved")
      .reduce((total, conversion) => total + conversion.commissionMinor, 0) ??
    0;
  const lastPayout = performance?.recentPayouts[0];

  return (
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
  );
}
