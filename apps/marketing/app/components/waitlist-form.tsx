import { useFetcher } from "react-router";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import LocationCityRoundedIcon from "@mui/icons-material/LocationCityRounded";
import PhoneIphoneRoundedIcon from "@mui/icons-material/PhoneIphoneRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import type { WaitlistResult } from "../lib/waitlist";

export function WaitlistForm() {
  const fetcher = useFetcher<WaitlistResult>();
  const result = fetcher.data;
  const submitting = fetcher.state !== "idle";
  const errors = result && !result.ok ? result.errors : undefined;

  if (result?.ok) {
    return (
      <Box
        sx={{
          position: "relative",
          textAlign: "center",
          py: { xs: 4, md: 6 },
          px: 2,
          overflow: "hidden",
          "&:before": {
            content: '""',
            position: "absolute",
            inset: "auto 50% 20px auto",
            width: 180,
            height: 180,
            borderRadius: "50%",
            bgcolor: "rgba(35,122,75,0.08)",
            transform: "translateX(50%)",
          },
        }}
      >
        <CheckCircleRoundedIcon
          sx={{ position: "relative", fontSize: 64, color: "success.main" }}
          aria-hidden
        />
        <Typography
          variant="h4"
          component="p"
          sx={{ position: "relative", mt: 2 }}
        >
          You’re on the list
        </Typography>
        <Typography
          sx={{
            position: "relative",
            mt: 1,
            color: "text.secondary",
            maxWidth: 420,
            mx: "auto",
          }}
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
        <Box>
          <Chip
            label="Private onboarding request"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mb: 1.5, bgcolor: "rgba(128,0,32,0.05)" }}
          />
          <Typography variant="h3" component="h2">
            Tell us about the shop
          </Typography>
          <Typography sx={{ mt: 1, color: "text.secondary" }}>
            A few details help us prepare your storefront, sizes, first designs
            and payment setup properly.
          </Typography>
        </Box>
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
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="name"
            label="Your name"
            required
            autoComplete="name"
            error={errors?.name !== undefined}
            helperText={errors?.name}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            name="business"
            label="Business name"
            required
            autoComplete="organization"
            error={errors?.business !== undefined}
            helperText={errors?.business}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <StorefrontRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            name="phone"
            label="Phone (WhatsApp is fine)"
            required
            autoComplete="tel"
            error={errors?.phone !== undefined}
            helperText={errors?.phone}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIphoneRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            name="email"
            label="Email (optional)"
            type="email"
            autoComplete="email"
            error={errors?.email !== undefined}
            helperText={errors?.email}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AlternateEmailRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <TextField
          name="city"
          label="Town or city (optional)"
          autoComplete="address-level2"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LocationCityRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          name="message"
          label="What do you sell? (optional)"
          multiline
          minRows={3}
          placeholder="e.g. bespoke menswear, ready-to-wear, bridal…"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment
                  position="start"
                  sx={{ alignSelf: "flex-start", mt: 1 }}
                >
                  <EditNoteRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
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
