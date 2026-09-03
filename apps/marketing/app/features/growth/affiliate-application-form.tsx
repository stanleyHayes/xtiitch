import { useFetcher } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import TextField from "../../components/form-text-field";
import type {
  AffiliateApplicationField,
  AffiliateApplicationResult,
} from "../../lib/affiliate-application";

type FormErrors = Partial<Record<AffiliateApplicationField, string>>;
const promotionChannels = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["whatsapp", "WhatsApp"],
  ["blog", "Blog or publication"],
  ["email", "Email community"],
  ["other", "Other"],
] as const;

function fieldState(
  errors: FormErrors | undefined,
  field: AffiliateApplicationField,
) {
  return {
    error: errors?.[field] !== undefined,
    helperText: errors?.[field],
  };
}

function AccountSuccess({ requestedCode }: { requestedCode: string }) {
  return (
    <Stack spacing={2} sx={{ py: { xs: 3, md: 5 }, textAlign: "center" }}>
      <CheckCircleRoundedIcon
        aria-hidden
        sx={{ mx: "auto", fontSize: 64, color: "success.main" }}
      />
      <Typography variant="h3" component="h2">
        Account created
      </Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 560, mx: "auto" }}>
        Check your email to set a password. Your code{" "}
        <strong>{requestedCode}</strong> is active and ready to share.
      </Typography>
      <Chip
        label="Ready to activate"
        color="success"
        variant="outlined"
        sx={{ alignSelf: "center" }}
      />
    </Stack>
  );
}

function ApplicantFields({ errors }: { errors?: FormErrors }) {
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <TextField
          name="applicant_type"
          label="Applying as"
          select
          defaultValue="person"
          required
          {...fieldState(errors, "applicant_type")}
        >
          <MenuItem value="person">Individual creator</MenuItem>
          <MenuItem value="business">Business</MenuItem>
          <MenuItem value="agency">Agency or media business</MenuItem>
        </TextField>
        <TextField
          name="display_name"
          label="Public affiliate name"
          required
          {...fieldState(errors, "display_name")}
        />
        <TextField
          name="contact_name"
          label="Contact name"
          autoComplete="name"
          required
          {...fieldState(errors, "contact_name")}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          {...fieldState(errors, "email")}
        />
        <TextField
          name="phone"
          label="Phone or WhatsApp"
          autoComplete="tel"
          {...fieldState(errors, "phone")}
        />
        <TextField
          name="website_url"
          label="Website or main social profile"
          placeholder="https://"
          {...fieldState(errors, "website_url")}
        />
      </Box>
      <TextField
        name="requested_code"
        label="Preferred affiliate code"
        placeholder="YOURCODE"
        required
        {...fieldState(errors, "requested_code")}
        helperText={
          errors?.requested_code ??
          "3–32 letters, numbers, hyphens, or underscores."
        }
        slotProps={{ htmlInput: { style: { textTransform: "uppercase" } } }}
      />
      <TextField
        name="audience_summary"
        label="Tell us about your audience and promotion plan"
        multiline
        minRows={4}
        required
        {...fieldState(errors, "audience_summary")}
      />
    </>
  );
}

function PromotionChannelFields({ error }: { error?: string }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 700 }}>Promotion channels</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
        Choose every channel you expect to use.
      </Typography>
      <FormGroup
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        {promotionChannels.map(([value, label]) => (
          <FormControlLabel
            key={value}
            control={
              <Checkbox name="promotion_channels" value={value} size="small" />
            }
            label={label}
          />
        ))}
      </FormGroup>
      {error ? (
        <Typography variant="body2" sx={{ color: "error.main" }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}

function ConsentField({ error }: { error?: string }) {
  return (
    <>
      <FormControlLabel
        control={<Checkbox name="consent" required />}
        label="I agree to the affiliate programme terms and to receive programme and account messages."
        sx={{
          alignItems: "flex-start",
          color: error ? "error.main" : "text.secondary",
          "& .MuiCheckbox-root": { mt: "-7px" },
        }}
      />
      {error ? (
        <Typography variant="body2" sx={{ color: "error.main", mt: -2 }}>
          {error}
        </Typography>
      ) : null}
    </>
  );
}

export function AffiliateApplicationForm() {
  const fetcher = useFetcher<AffiliateApplicationResult>();
  const result = fetcher.data;
  const errors = result && !result.ok ? result.errors : undefined;

  if (result?.ok) {
    return <AccountSuccess requestedCode={result.requestedCode} />;
  }

  return (
    <fetcher.Form method="post" noValidate>
      <Stack spacing={2.5}>
        <Box>
          <Chip label="Instant signup" color="primary" variant="outlined" />
          <Typography variant="h3" component="h2" sx={{ mt: 1.5 }}>
            Create your affiliate account
          </Typography>
          <Typography sx={{ mt: 1, color: "text.secondary" }}>
            Tell us who you reach and how you plan to introduce people to
            Xtiitch. You’ll receive a unique trackable code immediately.
          </Typography>
        </Box>
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          <TextField
            name="company_url"
            label="Company URL"
            tabIndex={-1}
            autoComplete="off"
          />
        </Box>
        {errors?.form ? <Alert severity="warning">{errors.form}</Alert> : null}
        <ApplicantFields errors={errors} />
        <PromotionChannelFields error={errors?.promotion_channels} />
        <ConsentField error={errors?.consent} />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={fetcher.state !== "idle"}
        >
          {fetcher.state !== "idle" ? "Creating account…" : "Create account"}
        </Button>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          We’ll email a secure link so you can set your password and open your
          dashboard.
        </Typography>
      </Stack>
    </fetcher.Form>
  );
}
