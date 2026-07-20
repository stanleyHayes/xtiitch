import { useState } from "react";
import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SaveRounded from "@mui/icons-material/SaveRounded";
import TextField from "../../components/form-text-field";
import { NETWORKS, looksLikeGhanaNumber } from "./payout-networks";

// The payout details form, including the §2.1 step that proves the number by a
// code sent to it before the details can be saved.
export function PayoutForm({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  provisioned,
  verified,
  settlementBank,
  settlementAccount,
  settlementAccountName,
  onCancel,
}: {
  provisioned: boolean;
  verified: boolean;
  settlementBank?: string;
  settlementAccount?: string;
  settlementAccountName?: string;
  onCancel?: () => void;
}) {
  const [account, setAccount] = useState(settlementAccount ?? "");
  // §2.1: the MoMo-registered wallet name. It becomes the Paystack subaccount's
  // business name, so it must be the exact legal name on the wallet.
  const [accountName, setAccountName] = useState(settlementAccountName ?? "");
  const [numberError, setNumberError] = useState<string | undefined>(undefined);
  // Controlled, because the network is half of what the API treats as "the
  // payout details": leaving it uncontrolled hid a network change from the
  // check below, and the server then demanded a code this form never offered.
  const [bank, setBank] = useState(settlementBank || "MTN");
  const [code, setCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState<string | undefined>(undefined);

  // This predicate MUST mirror the API's no-op condition TERM FOR TERM:
  // verified AND a subaccount exists AND the number is unchanged AND the network
  // is unchanged. Miss any one and the form and the server disagree about
  // whether a code is needed — the server wins, and the owner is stranded on an
  // error telling them to enter a code with no field to enter it in.
  //
  // `verified` is its own term because an admin can reject a business that
  // already has a payout subaccount: the subaccount survives, so `provisioned`
  // stays true while the server stops treating a resubmit as a no-op.
  //
  // Comparing against `settlementBank ?? ""` rather than the "MTN" default is
  // deliberate: a business set up before the network was recorded has none, so
  // the default reads as a change and correctly asks for a code, which is what
  // lets that first resubmit record the network at last.
  const numberChanged = account.trim() !== (settlementAccount ?? "").trim();
  const bankChanged = bank !== (settlementBank ?? "");
  const needsCode = !provisioned || !verified || numberChanged || bankChanged;

  async function requestCode() {
    setOtpSending(true);
    setOtpError(undefined);
    try {
      const response = await fetch("/payout-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlement_account: account.trim() }),
      });
      if (response.ok) {
        setOtpRequested(true);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (body.error === "resend_too_soon") {
        // A code is already out and still valid, so move to the code field
        // rather than stranding the owner on a button that looks broken.
        setOtpRequested(true);
        setOtpError("A code was just sent. Check your phone before resending.");
        return;
      }
      setOtpError(otpRequestErrorMessage(body.error));
    } catch {
      setOtpError("Could not send a code right now. Try again in a moment.");
    } finally {
      setOtpSending(false);
    }
  }

  return (
    <Form
      method="post"
      onSubmit={(event) => {
        // §2.1: exactly 10 local digits, checked before the form can leave —
        // the API rejects anything else with invalid_payout_number anyway.
        if (!looksLikeGhanaNumber(account)) {
          event.preventDefault();
          setNumberError(
            "Enter the MoMo number in its 10-digit local form (e.g. 0240000000).",
          );
        }
      }}
    >
      <input type="hidden" name="intent" value="setup_payout" />
      {/* The code field unmounts when no code is needed, so its value rides
          along in a hidden mirror rather than vanishing on submit. */}
      <input type="hidden" name="otp_code" value={code} />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mt: 2, alignItems: { sm: "center" } }}
      >
        <TextField
          name="settlement_bank"
          label="Network"
          select
          required
          value={bank}
          onChange={(event) => {
            setBank(event.target.value);
            // A code proves one specific number-and-network pair, so switching
            // network invalidates one already sent — same rule as the number.
            setOtpRequested(false);
            setCode("");
          }}
          sx={{ minWidth: { sm: 160 } }}
          fullWidth
        >
          {NETWORKS.map((network) => (
            <MenuItem key={network.code} value={network.code}>
              {network.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="settlement_account"
          label="Mobile money number"
          placeholder="024 000 0000"
          required
          fullWidth
          value={account}
          onChange={(event) => {
            setAccount(event.target.value);
            // The code proves one specific number, so editing the number
            // invalidates a code already sent to the previous one.
            setOtpRequested(false);
            setCode("");
            if (numberError) {
              setNumberError(undefined);
            }
          }}
          onBlur={() => {
            if (account.trim() && !looksLikeGhanaNumber(account)) {
              setNumberError(
                "Enter the MoMo number in its 10-digit local form (e.g. 0240000000).",
              );
            }
          }}
          error={Boolean(numberError)}
          helperText={numberError ?? "Exactly 10 digits, local form."}
        />
      </Stack>

      <TextField
        name="settlement_account_name"
        label="MoMo Account Name"
        required
        fullWidth
        value={accountName}
        onChange={(event) => setAccountName(event.target.value)}
        helperText="Enter the exact legal name that pops up when someone tries to send money to this MoMo number."
        sx={{ mt: 1.5 }}
      />

      {needsCode ? (
        <PayoutOTPStep
          account={account}
          code={code}
          otpRequested={otpRequested}
          otpSending={otpSending}
          onRequest={requestCode}
          onCodeChange={setCode}
        />
      ) : null}

      {otpError ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {otpError}
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
        <Button
          type="submit"
          variant="contained"
          startIcon={<SaveRounded />}
          disabled={(needsCode && !code.trim()) || !accountName.trim()}
          sx={{ flexShrink: 0 }}
        >
          Save payout details
        </Button>
        {onCancel ? (
          <Button variant="text" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </Stack>
    </Form>
  );
}

// Friendly copy for the payout-OTP request failures the API reports. Each code
// implies a different fix — the sequence gate (§2.2), the number itself, or a
// transient fault — so they stay distinct.
function otpRequestErrorMessage(code: string | undefined): string {
  switch (code) {
    case "identity_verification_required":
      // §2.2 fallback: the panel already locks payout setup until an admin
      // approves the Ghana Card, so this should be unreachable — but if the
      // API says it, show the same explanation rather than a dead end.
      return "Complete your Ghana Card business verification first — payout details unlock after an admin approves it.";
    case "invalid_payout_number":
      return "Enter the MoMo number in its 10-digit local form (e.g. 0240000000).";
    case "invalid_phone":
      return "That doesn't look like a Ghana mobile money number.";
    default:
      return "Could not send a code to that number. Check it and retry.";
  }
}

function PayoutOTPStep({
  account,
  code,
  otpRequested,
  otpSending,
  onRequest,
  onCodeChange,
}: {
  account: string;
  code: string;
  otpRequested: boolean;
  otpSending: boolean;
  onRequest: () => void;
  onCodeChange: (value: string) => void;
}) {
  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mt: 1.5, alignItems: { sm: "center" } }}
      >
        <Button
          variant="outlined"
          onClick={onRequest}
          disabled={!looksLikeGhanaNumber(account) || otpSending}
          // Kept visible while disabled rather than hidden, so the button does
          // not appear only once the number happens to look valid.
          sx={{
            flexShrink: 0,
            alignSelf: { xs: "stretch", sm: "auto" },
            "&.Mui-disabled": { opacity: 0.6 },
          }}
        >
          {otpSending ? "Sending…" : otpRequested ? "Resend code" : "Verify number"}
        </Button>
        {otpRequested ? (
          <TextField
            label="Verification code"
            placeholder="123456"
            required
            fullWidth
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
          />
        ) : null}
      </Stack>
      {otpRequested ? (
        <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
          We sent a code to {account.trim()}. Enter it to confirm the number is
          live and yours.
        </Typography>
      ) : null}
    </>
  );
}
