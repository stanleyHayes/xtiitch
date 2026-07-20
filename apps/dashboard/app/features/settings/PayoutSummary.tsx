import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { networkLabel } from "./payout-networks";

// The settled state for payout details: what is on file, plus a way back into
// the form. Mirrors BusinessVerificationPanel's completed state (§2.1) — once
// there is nothing to do, the panel says so rather than presenting an open
// form.
export function PayoutSummary({
  settlementBank,
  settlementAccount,
  settlementAccountName,
  onEdit,
}: {
  settlementBank?: string;
  settlementAccount?: string;
  settlementAccountName?: string;
  onEdit: () => void;
}) {
  const network = networkLabel(settlementBank ?? "");
  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <Box>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Payout details successfully submitted
        </Typography>
        <Typography sx={{ fontWeight: 700 }}>
          {settlementAccount ? `${network} · ${settlementAccount}` : network}
        </Typography>
        {/* §2.1: the summary shows the network name, the MoMo number AND the
            MoMo account name — the exact trio the Paystack subaccount was
            built from. */}
        {settlementAccountName ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {settlementAccountName}
          </Typography>
        ) : null}
      </Box>
      <Button
        variant="outlined"
        onClick={onEdit}
        sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
      >
        Update payout details
      </Button>
    </Stack>
  );
}
