import { useState } from "react";
import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { CardDropzone } from "../../components/ui/CardDropzone";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import {
  formatGhanaCardNumber,
  isValidGhanaCardNumber,
} from "../../lib/ghana-card";
import { useResetOnSuccess } from "./useResetOnSuccess";

export function BusinessVerificationPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  status,
  error,
  success,
}: {
  status: string;
  error?: string;
  success?: string;
}) {
  const [legalName, setLegalName] = useState("");
  // Controlled + format-locked (§2.3): the value is rebuilt into the
  // GHA-XXXXXXXXX-X shape on every keystroke so a wrong format cannot be
  // entered, then validated against the full pattern before submit.
  const [cardNumber, setCardNumber] = useState("");
  const [cardError, setCardError] = useState<string | undefined>(undefined);
  const [photoName, setPhotoName] = useState("");
  const [photoBackName, setPhotoBackName] = useState("");
  // §1.2: after a successful submit the inline form resets itself. Remounting
  // the Form drops every uncontrolled field (file inputs included); the
  // callback clears the controlled pieces.
  const [formKey, setFormKey] = useState(0);
  useResetOnSuccess(
    () => {
      setLegalName("");
      setCardNumber("");
      setCardError(undefined);
      setPhotoName("");
      setPhotoBackName("");
      setFormKey((key) => key + 1);
    },
    "submit_identity_verification",
    Boolean(error),
  );
  const verified = status === "verified";
  const pending = status === "pending";
  const rejected = status === "rejected";
  const tone = verified
    ? "#1b7f4d"
    : pending
      ? tokens.burgundy
      : rejected
        ? "#b3261e"
        : alpha(tokens.ink, 0.5);
  const label = verified
    ? "Verified"
    : pending
      ? "In review"
      : rejected
        ? "Rejected — resubmit"
        : "Not verified";

  return (
    <Panel id="verification" sx={{ mt: 2 }}>
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <VerifiedUserRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
                Business verification
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Submit your Ghana Card to verify your business and take
                payments.
              </Typography>
            </Box>
          </Stack>
          <ToneChip label={label} tone={tone} />
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

        {verified ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Your business is verified. There's nothing more to do here.
          </Alert>
        ) : (
          <Form
            key={formKey}
            method="post"
            encType="multipart/form-data"
            onSubmit={(event) => {
              // Client-side pattern check (§2.3); the action re-checks
              // server-side, so a bypassed check still cannot save a
              // malformed number.
              if (!isValidGhanaCardNumber(cardNumber)) {
                event.preventDefault();
                setCardError(
                  "Enter your Ghana Card number in the exact format GHA-123456789-0.",
                );
              }
            }}
          >
            <input
              type="hidden"
              name="intent"
              value="submit_identity_verification"
            />
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {pending ? (
                <Alert severity="info">
                  Your Ghana Card is under review. You can resubmit if you need
                  to correct anything.
                </Alert>
              ) : null}
              <TextField
                name="full_legal_name"
                label="Full Legal Name (on the Ghana Card)"
                required
                fullWidth
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                helperText="Must match your official ID exactly — no shop names or nicknames."
              />
              <TextField
                name="card_number"
                label="Ghana Card number"
                placeholder="GHA-000000000-0"
                required
                fullWidth
                value={cardNumber}
                onChange={(event) => {
                  setCardNumber(formatGhanaCardNumber(event.target.value));
                  if (cardError) {
                    setCardError(undefined);
                  }
                }}
                onBlur={() => {
                  if (cardNumber && !isValidGhanaCardNumber(cardNumber)) {
                    setCardError(
                      "Enter your Ghana Card number in the exact format GHA-123456789-0.",
                    );
                  }
                }}
                error={Boolean(cardError)}
                helperText={cardError}
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
              >
                <CardDropzone
                  name="id_photo_file"
                  side="Front"
                  fileName={photoName}
                  onFile={setPhotoName}
                />
                <CardDropzone
                  name="id_photo_back_file"
                  side="Back"
                  fileName={photoBackName}
                  onFile={setPhotoBackName}
                />
              </Stack>
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Clear photos of the front and back of your Ghana Card (both
                required).
              </Typography>
              <Button type="submit" variant="contained">
                {rejected || pending
                  ? "Resubmit for review"
                  : "Submit for verification"}
              </Button>
            </Stack>
          </Form>
        )}
      </Box>
    </Panel>
  );
}
