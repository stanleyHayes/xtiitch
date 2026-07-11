import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
} from "../../../lib/api";
import { Panel } from "../../../components/ui/Panel";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import { CardDetailAction } from "../../shared/CardDetailAction";
import {
  affiliateCommissionLabel,
  affiliateEntityLabel,
  affiliatePayoutLabel,
  affiliateStatusColor,
  affiliateStatusLabel,
} from "../utils";

export function AffiliateDetail({
  affiliate,
  performance,
  onOpen,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
  onOpen: () => void;
}) {
  const color = affiliateStatusColor(affiliate.status);
  const archived = affiliate.status === "archived";
  const approvedConversionCount = performance?.approvedConversionCount ?? 0;
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
              <Typography variant="h6">{affiliate.displayName}</Typography>
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
          onClick={onOpen}
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
}
