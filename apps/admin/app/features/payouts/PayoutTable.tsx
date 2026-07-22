import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../shared/formatting";
import { shortTimeOrFallback } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import type { AdminPayoutRow } from "../../lib/api";

export function payoutStatusColor(status: string): string { switch (status.trim().toLowerCase()) { case "success": case "successful": case "paid": return tokens.success; case "pending": case "processing": case "queued": return tokens.warning; case "failed": case "reversed": return tokens.danger; default: return tokens.mutedText; } }
export function PayoutStatusChip({ status }: { status: string }) { const color = payoutStatusColor(status); return <Chip size="small" label={status || "unknown"} sx={{ bgcolor: alpha(color, .12), color, border: "1px solid", borderColor: alpha(color, .24), textTransform: "capitalize" }} />; }

export function PayoutTable({ payouts, selectedId, onInspect }: { payouts: AdminPayoutRow[]; selectedId: string | null; onInspect: (payout: AdminPayoutRow) => void; }) {
  return <Panel sx={{ overflow: "hidden" }}>{payouts.map((payout, index) => <Box key={payout.businessId} component="button" type="button" onClick={() => onInspect(payout)} sx={{ width: "100%", p: { xs: 2, md: 2.25 }, display: "grid", gridTemplateColumns: { xs: "auto 1fr auto", md: "auto minmax(220px, 1.1fr) repeat(3, minmax(130px, .55fr)) auto" }, gap: 1.5, alignItems: "center", border: 0, borderBottom: index === payouts.length - 1 ? 0 : "1px solid", borderColor: "divider", bgcolor: selectedId === payout.businessId ? alpha(tokens.burgundy, .05) : "transparent", color: "text.primary", textAlign: "left", cursor: "pointer", font: "inherit", "&:hover": { bgcolor: alpha(tokens.burgundy, .045) } }}>
    <Box sx={{ width: 42, height: 42, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: alpha(tokens.burgundy, .09), color: tokens.burgundy }}><AccountBalanceWalletRounded /></Box>
    <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 900 }}>{payout.businessName}</Typography><Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{payout.handle}.xtiitch.com · {payout.momoNetwork || "No MoMo"} {payout.momoNumber || ""}</Typography></Box>
    <Box sx={{ display: { xs: "none", md: "block" } }}><Typography variant="caption" sx={{ color: "text.secondary" }}>Sales</Typography><Typography sx={{ fontWeight: 900 }}>{formatGHS(payout.totalSalesMinor)}</Typography></Box>
    <Box sx={{ display: { xs: "none", md: "block" } }}><Typography variant="caption" sx={{ color: "text.secondary" }}>Settled</Typography><Typography sx={{ fontWeight: 900 }}>{formatGHS(payout.totalSettledMinor)}</Typography></Box>
    <Box sx={{ display: { xs: "none", md: "block" } }}><Typography variant="caption" sx={{ color: "text.secondary" }}>Amount due</Typography><Typography sx={{ fontWeight: 900 }}>{formatGHS(payout.amountDueMinor)}</Typography></Box>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>{payout.lastPayoutStatus ? <PayoutStatusChip status={payout.lastPayoutStatus} /> : <Typography variant="caption" sx={{ display: { xs: "none", sm: "block" }, color: "text.secondary" }}>{shortTimeOrFallback(payout.lastPayoutAt, "Never paid")}</Typography>}<ArrowForwardRounded sx={{ color: tokens.burgundy }} /></Stack>
  </Box>)}</Panel>;
}
