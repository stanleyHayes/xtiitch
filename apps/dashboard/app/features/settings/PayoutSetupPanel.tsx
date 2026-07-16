import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { tokens } from "../../theme";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { PayoutForm } from "./PayoutForm";
import { PayoutSummary } from "./PayoutSummary";
import { useCloseOnSuccess } from "./useCloseOnSuccess";

export function PayoutSetupPanel({
  provisioned,
  settlementBank,
  settlementAccount,
  error,
  success,
}: {
  provisioned: boolean;
  settlementBank?: string;
  settlementAccount?: string;
  error?: string;
  success?: string;
}) {
  // Payouts already set up collapses to a summary (§3.2/§3.3); "Update payout
  // details" reopens the form. Editing is the exception, so the form starts
  // closed for anyone who has already set payouts up.
  const [editing, setEditing] = useState(!provisioned);

  // Collapse once the save settles. This watches the SUBMISSION, not the success
  // message: every save returns the same success string, so an effect keyed on
  // that text fires once and never again, leaving the form open on every save
  // after the first.
  useCloseOnSuccess(setEditing, "setup_payout", Boolean(error));

  return (
    <Panel id="payouts" sx={{ mt: 2 }}>
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <PaymentsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Payout details</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                The mobile money number your settlements are paid out to.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={provisioned ? "Set up" : "Needs setup"}
            tone={provisioned ? "#1b7f4d" : tokens.burgundy}
          />
        </Stack>
        {success ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        {provisioned && !editing ? (
          <PayoutSummary
            settlementBank={settlementBank}
            settlementAccount={settlementAccount}
            onEdit={() => setEditing(true)}
          />
        ) : (
          <PayoutForm
            // Remount on cancel so the form's own draft state (typed number,
            // requested code) resets to what is saved rather than persisting a
            // half-finished edit into the next open.
            key={editing ? "editing" : "closed"}
            provisioned={provisioned}
            settlementBank={settlementBank}
            settlementAccount={settlementAccount}
            onCancel={provisioned ? () => setEditing(false) : undefined}
          />
        )}
      </Box>
    </Panel>
  );
}
