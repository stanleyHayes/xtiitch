import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockRounded from "@mui/icons-material/LockRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { tokens } from "../../theme";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { PayoutForm } from "./PayoutForm";
import { PayoutSummary } from "./PayoutSummary";
import { useCloseOnSuccess } from "./useCloseOnSuccess";

export function PayoutSetupPanel({
  provisioned,
  verified,
  settlementBank,
  settlementAccount,
  settlementAccountName,
  error,
  success,
}: {
  provisioned: boolean;
  // Whether the business is identity-verified BY AN ADMIN (§2.2). Distinct
  // from `provisioned`: an admin can reject a business that already has a
  // payout subaccount, and the API stops treating a resubmit as a no-op when
  // it does. Payout setup ("payout_status: ready") is a payout state, never
  // a verification — only the approved Ghana Card check verifies a business.
  verified: boolean;
  settlementBank?: string;
  settlementAccount?: string;
  settlementAccountName?: string;
  error?: string;
  success?: string;
}) {
  // Payouts already set up collapses to a summary (§2.1); "Update payout
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
          {/* The chip reflects the REAL verification state (§2.2): until an
              admin approves the Ghana Card the section is locked, whatever the
              payout state says. */}
          <ToneChip
            label={
              !verified
                ? "Verification required"
                : provisioned
                  ? "Set up"
                  : "Needs setup"
            }
            tone={
              !verified
                ? tokens.burgundy
                : provisioned
                  ? "#1b7f4d"
                  : tokens.burgundy
            }
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

        {!verified ? (
          // §2.2: Ghana Card verification comes FIRST. Until an admin approves
          // it the payout form is never rendered (and no code is requested —
          // the API rejects both with 409 identity_verification_required).
          <Alert severity="info" icon={<LockRounded />} sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>
              Payout details are locked for now.
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Complete your Ghana Card business verification first — payout
              details unlock after an admin approves it. A business is verified
              by that approval only, never by setting up payouts.
            </Typography>
            <Button
              href="#verification"
              size="small"
              variant="outlined"
              sx={{ mt: 1.25 }}
            >
              Go to business verification
            </Button>
          </Alert>
        ) : provisioned && !editing ? (
          <PayoutSummary
            settlementBank={settlementBank}
            settlementAccount={settlementAccount}
            settlementAccountName={settlementAccountName}
            onEdit={() => setEditing(true)}
          />
        ) : (
          <PayoutForm
            // Remount on cancel so the form's own draft state (typed number,
            // requested code) resets to what is saved rather than persisting a
            // half-finished edit into the next open.
            key={editing ? "editing" : "closed"}
            provisioned={provisioned}
            verified={verified}
            settlementBank={settlementBank}
            settlementAccount={settlementAccount}
            settlementAccountName={settlementAccountName}
            onCancel={provisioned ? () => setEditing(false) : undefined}
          />
        )}
      </Box>
    </Panel>
  );
}
