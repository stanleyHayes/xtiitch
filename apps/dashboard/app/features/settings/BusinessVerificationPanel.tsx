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

export function BusinessVerificationPanel({
  status,
  error,
  success,
}: {
  status: string;
  error?: string;
  success?: string;
}) {
  const [photoName, setPhotoName] = useState("");
  const [photoBackName, setPhotoBackName] = useState("");
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
          <Form method="post" encType="multipart/form-data">
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
                name="card_number"
                label="Ghana Card number"
                placeholder="GHA-000000000-0"
                required
                fullWidth
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