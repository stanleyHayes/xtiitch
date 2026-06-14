import { useFetcher } from "react-router";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import type { WaitlistResult } from "../lib/waitlist";

export function WaitlistForm() {
  const fetcher = useFetcher<WaitlistResult>();
  const result = fetcher.data;
  const submitting = fetcher.state !== "idle";
  const errors = result && !result.ok ? result.errors : undefined;

  if (result?.ok) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <CheckCircleRoundedIcon
          sx={{ fontSize: 56, color: "success.main" }}
          aria-hidden
        />
        <Typography variant="h4" component="p" sx={{ mt: 2 }}>
          You’re on the list
        </Typography>
        <Typography
          sx={{ mt: 1, color: "text.secondary", maxWidth: 420, mx: "auto" }}
        >
          Thanks — your request has been sent. We’ll be in touch as onboarding
          opens for new businesses.
        </Typography>
      </Box>
    );
  }

  return (
    <fetcher.Form method="post" noValidate>
      <Stack spacing={2.5}>
        <Box
          sx={{
            position: "absolute",
            width: 1,
            height: 1,
            p: 0,
            m: -1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          <TextField
            name="website"
            label="Website"
            autoComplete="off"
            tabIndex={-1}
            aria-hidden
          />
        </Box>
        {result && !result.ok ? (
          <Alert severity="warning">
            {errors?.form ??
              "Please check the highlighted fields and try again."}
          </Alert>
        ) : null}
        <TextField
          name="name"
          label="Your name"
          required
          autoComplete="name"
          error={errors?.name !== undefined}
          helperText={errors?.name}
        />
        <TextField
          name="business"
          label="Business name"
          required
          autoComplete="organization"
          error={errors?.business !== undefined}
          helperText={errors?.business}
        />
        <TextField
          name="phone"
          label="Phone (WhatsApp is fine)"
          required
          autoComplete="tel"
          error={errors?.phone !== undefined}
          helperText={errors?.phone}
        />
        <TextField
          name="email"
          label="Email (optional)"
          type="email"
          autoComplete="email"
          error={errors?.email !== undefined}
          helperText={errors?.email}
        />
        <TextField
          name="city"
          label="Town or city (optional)"
          autoComplete="address-level2"
        />
        <TextField
          name="message"
          label="What do you sell? (optional)"
          multiline
          minRows={3}
          placeholder="e.g. bespoke menswear, ready-to-wear, bridal…"
        />
        <FormControlLabel
          control={<Checkbox name="consent" required />}
          label="Xtiitch may contact me about onboarding this business."
          sx={{
            alignItems: "flex-start",
            color: errors?.consent ? "error.main" : "text.secondary",
            "& .MuiCheckbox-root": { mt: "-7px" },
          }}
        />
        {errors?.consent ? (
          <Typography variant="body2" sx={{ color: "error.main", mt: -1.5 }}>
            {errors.consent}
          </Typography>
        ) : null}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting}
        >
          {submitting ? "Sending…" : "Join the waitlist"}
        </Button>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          We’ll only use your details to set up your store and reach you about
          Xtiitch.
        </Typography>
      </Stack>
    </fetcher.Form>
  );
}
