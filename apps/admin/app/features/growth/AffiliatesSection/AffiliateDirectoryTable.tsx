import { useMemo } from "react";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import type { AdminAffiliate, AdminAffiliateAttribution } from "../../../lib/api";
import { Panel } from "../../../components/ui/Panel";
import { AffiliateLifecycleActions } from "../AdminAffiliateDetailForm/AffiliateLifecycleActions";
import { formatGHS } from "../../shared/formatting";
import {
  affiliateCommissionLabel,
  affiliateEntityLabel,
  affiliatePayoutLabel,
  affiliateStatusColor,
  affiliateStatusLabel,
} from "../utils";

export function AffiliateDirectoryTable({
  affiliates,
  affiliateAttribution,
  onSelect,
}: {
  affiliates: AdminAffiliate[];
  affiliateAttribution: AdminAffiliateAttribution[];
  onSelect: (affiliateId: string) => void;
}) {
  const attributionByAffiliate = useMemo(
    () => new Map(affiliateAttribution.map((item) => [item.affiliateId, item] as const)),
    [affiliateAttribution],
  );

  return (
    <Panel sx={{ overflow: "hidden" }}>
      <TableContainer sx={{ overflowX: { xs: "visible", md: "auto" } }}>
        <Table size="small" aria-label="Affiliates" sx={{ width: "100%", minWidth: { md: 980 }, tableLayout: { xs: "fixed", md: "auto" } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "rgba(var(--surface-rgb), 0.72)" }}>
              <TableCell sx={{ width: { xs: "42%", md: "auto" } }}>Affiliate</TableCell>
              <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Contact</TableCell>
              <TableCell sx={{ width: { xs: "21%", md: "auto" } }}>Status</TableCell>
              <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Commission</TableCell>
              <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>Clicks</TableCell>
              <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>Conversions</TableCell>
              <TableCell align="right" sx={{ display: { xs: "none", lg: "table-cell" } }}>Generated</TableCell>
              <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>Payout</TableCell>
              <TableCell align="right" sx={{ width: { xs: "37%", md: "auto" }, position: { md: "sticky" }, right: { md: 0 }, bgcolor: "background.paper", zIndex: 1 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {affiliates.map((affiliate) => {
              const performance = attributionByAffiliate.get(affiliate.affiliateId);
              const statusColor = affiliateStatusColor(affiliate.status);
              return (
                <TableRow key={affiliate.affiliateId} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: { xs: 1.25, md: 1 }, px: { xs: 1, md: 2 }, overflow: "hidden" }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 900 }}>{affiliate.displayName}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{affiliate.code} · {affiliateEntityLabel(affiliate.entityType)}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: "block", md: "none" } }}>{affiliate.email || affiliate.phone || "No contact"}</Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    <Typography variant="body2">{affiliate.email || affiliate.phone || "Not provided"}</Typography>
                    {affiliate.email && affiliate.phone ? <Typography variant="caption" color="text.secondary">{affiliate.phone}</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ px: { xs: 0.5, md: 2 } }}>
                    <Chip size="small" label={affiliateStatusLabel(affiliate.status)} sx={{ maxWidth: "100%", bgcolor: alpha(statusColor, 0.12), color: statusColor, fontWeight: 900, "& .MuiChip-label": { px: { xs: 0.75, md: 1.5 }, overflow: "hidden", textOverflow: "ellipsis" } }} />
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{affiliateCommissionLabel(affiliate)}</TableCell>
                  <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" }, fontVariantNumeric: "tabular-nums" }}>{performance?.clickCount ?? 0}</TableCell>
                  <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" }, fontVariantNumeric: "tabular-nums" }}>{performance?.conversionCount ?? 0}</TableCell>
                  <TableCell align="right" sx={{ display: { xs: "none", lg: "table-cell" }, fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>{formatGHS(performance?.commissionMinor ?? 0)}</TableCell>
                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>{affiliatePayoutLabel(affiliate.payoutMode)}</TableCell>
                  <TableCell align="right" sx={{ px: { xs: 0.5, md: 2 }, position: { md: "sticky" }, right: { md: 0 }, bgcolor: "background.paper", zIndex: 1 }}>
                    <Stack direction="row" spacing={0} sx={{ justifyContent: "flex-end", alignItems: "center", whiteSpace: "nowrap" }}>
                      <AffiliateLifecycleActions affiliate={affiliate} compact />
                      <Tooltip title="View Affiliate details">
                        <IconButton size="small" color="primary" aria-label={`View ${affiliate.displayName} details`} onClick={() => onSelect(affiliate.affiliateId)}><VisibilityRounded /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Panel>
  );
}
