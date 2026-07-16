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

// The payout details form, including the §3.1 step that proves the number by a
// code sent to it before the details can be saved.
export function PayoutForm({
  provisioned,
  settlementBank,
  settlementAccount,
  onCancel,
}: {
  provisioned: boolean;
  settlementBank?: string;
  settlementAccount?: string;
  onCancel?: () => void;
}) {
  const [account, setAccount] = useState(settlementAccount ?? "");
  const [code, setCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState<string | undefined>(undefined);

  const numberChanged = account.trim() !== (settlementAccount ?? "").trim();
  // A saved number that has not changed was already proved, so re-proving it to
  // switch network alone would be busywork. A new number always needs proof.
  const needsCode = numberChanged || !provisioned;

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
      setOtpError(
        body.error === "invalid_phone"
          ? "That doesn't look like a Ghana mobile money number."
          : "Could not send a code to that number. Check it and retry.",
      );
    } catch {
      setOtpError("Could not send a code right now. Try again in a moment.");
    } finally {
      setOtpSending(false);
    }
  }

  return (
    <Form method="post">
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
          defaultValue={settlementBank || "MTN"}
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
          }}
        />
      </Stack>

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
          disabled={needsCode && !code.trim()}
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
