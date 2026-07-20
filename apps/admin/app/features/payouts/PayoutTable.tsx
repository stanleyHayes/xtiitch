import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { formatGHS } from "../shared/formatting";
import { shortTimeOrFallback } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import type { AdminPayoutRow } from "../../lib/api";



// Paystack settlement statuses, coloured like the rest of the console:
// green when the money landed, amber while in flight, red on failure.
export function payoutStatusColor(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "success":
    case "successful":
    case "paid":
      return tokens.success;
    case "pending":
    case "processing":
    case "queued":
      return tokens.warning;
    case "failed":
    case "reversed":
      return tokens.danger;
    default:
      return tokens.mutedText;
  }
}



export function PayoutStatusChip({ status }: { status: string }) {
  const color = payoutStatusColor(status);
  return (
    <Chip
      size="small"
      label={status || "unknown"}
      sx={{
        bgcolor: alpha(color, 0.12),
        color,
        border: "1px solid",
        borderColor: alpha(color, 0.24),
        textTransform: "capitalize",
      }}
    />
  );
}



// §11.5: one row per store. Every figure comes from the API (which reads
// Paystack) — the table formats but never computes.
export function PayoutTable({
  payouts,
  selectedId,
  onInspect,
}: {
  payouts: AdminPayoutRow[];
  selectedId: string | null;
  onInspect: (payout: AdminPayoutRow) => void;
}) {
  return (
    <Panel sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 1240 }}>
        <TableHead>
          <TableRow>
            <TableCell>Business</TableCell>
            <TableCell>Owner legal name</TableCell>
            <TableCell>MoMo destination</TableCell>
            <TableCell>MoMo account name</TableCell>
            <TableCell>Subaccount</TableCell>
            <TableCell align="right">Total sales</TableCell>
            <TableCell align="right">Total settled</TableCell>
            <TableCell align="right">Xtiitch fees + tax</TableCell>
            <TableCell align="right">Amount due</TableCell>
            <TableCell>Last payout</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payouts.map((payout) => (
            <TableRow
              key={payout.businessId}
              hover
              selected={selectedId === payout.businessId}
              sx={{ cursor: "pointer" }}
              onClick={() => onInspect(payout)}
            >
              <TableCell sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }} noWrap>
                  {payout.businessName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                >
                  {payout.handle}.xtiitch.com
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {payout.ownerLegalName || "—"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {payout.momoNetwork || "—"}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {payout.momoNumber || "No number on file"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {payout.momoAccountName || "—"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                >
                  {payout.subaccountCode || "Not provisioned"}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography sx={{ fontWeight: 700 }}>
                  {formatGHS(payout.totalSalesMinor)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography sx={{ fontWeight: 700 }}>
                  {formatGHS(payout.totalSettledMinor)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Stack spacing={0.25} sx={{ alignItems: "flex-end" }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatGHS(payout.xtiitchFeesMinor)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    tax {formatGHS(payout.xtiitchTaxMinor)}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Typography sx={{ fontWeight: 800 }}>
                  {formatGHS(payout.amountDueMinor)}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {shortTimeOrFallback(payout.lastPayoutAt, "Never")}
                  </Typography>
                  {payout.lastPayoutStatus ? (
                    <PayoutStatusChip status={payout.lastPayoutStatus} />
                  ) : null}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
