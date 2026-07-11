import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../theme";
import { formatGHS } from "../../shared/formatting";
import { shortID, shortTime } from "../../shared/dates";
import type { AdminAffiliate, AdminAffiliateAttribution } from "../../../lib/api";

export function AffiliatePayoutsPanel({
  affiliate,
  performance,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
}) {
  return (
    <Stack spacing={1.5}>
      {performance?.recentPayouts.length ? (
        <Box
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.success, 0.14),
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.7)",
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 900 }}
          >
            Recent payouts
          </Typography>
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {performance.recentPayouts.map((payout) => (
              <Stack
                key={payout.payoutBatchId}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: "rgba(var(--surface-rgb), 0.76)",
                  justifyContent: "space-between",
                  alignItems: { sm: "center" },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>
                    {formatGHS(payout.commissionMinor)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {payout.payoutReference || shortID(payout.payoutBatchId)}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <Chip
                    size="small"
                    label={payout.status}
                    variant="outlined"
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary" }}
                  >
                    {payout.conversionCount} rows ·{" "}
                    {shortTime(payout.createdAt)}
                  </Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Box>
      ) : null}

      {affiliate.notes || affiliate.payoutReference ? (
        <Box
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.08),
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.7)",
          }}
        >
          {affiliate.payoutReference ? (
            <Typography sx={{ overflowWrap: "anywhere" }}>
              {affiliate.payoutReference}
            </Typography>
          ) : null}
          {affiliate.notes ? (
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Notes: {affiliate.notes}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}
