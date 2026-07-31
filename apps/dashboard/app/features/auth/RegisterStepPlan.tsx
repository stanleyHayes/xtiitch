import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { formatPlanPrice } from "./Register";

export function RegisterStepPlan({
  affiliateCode,
  affiliateCodeFromLink,
  onAffiliateCodeChange,
  plans,
  selectedPlan,
  onSelectPlan,
}: {
  plans: {
    code: string;
    name: string;
    monthly_fee_minor: number;
    commission_bps: number;
  }[];
  selectedPlan: string;
  onSelectPlan: (code: string) => void;
  affiliateCode: string;
  // True when it arrived on the invite link, so the copy can confirm it was
  // applied rather than inviting the owner to fill in something they don't have.
  affiliateCodeFromLink: boolean;
  onAffiliateCodeChange: (code: string) => void;
}) {
  return (
    <Box>
      {plans.length > 0 ? (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 800,
              mb: 1,
              color: alpha(tokens.ink, 0.8),
            }}
          >
            Choose a plan
          </Typography>
          <Stack spacing={1}>
            {plans.map((plan) => (
              <Box
                key={plan.code}
                component="label"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: alpha(tokens.ink, 0.16),
                  cursor: "pointer",
                  transition:
                    "border-color 160ms ease, background 160ms",
                  "&:has(input:checked)": {
                    borderColor: tokens.burgundy,
                    bgcolor: alpha(tokens.burgundy, 0.05),
                    boxShadow: `0 0 0 3px ${alpha(tokens.burgundy, 0.1)}`,
                  },
                }}
              >
                <Box
                  component="input"
                  type="radio"
                  name="plan_code"
                  value={plan.code}
                  checked={selectedPlan === plan.code}
                  onChange={() => onSelectPlan(plan.code)}
                  sx={{
                    accentColor: tokens.burgundy,
                    width: 18,
                    height: 18,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    {plan.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: alpha(tokens.ink, 0.6) }}
                  >
                    {(plan.commission_bps / 100).toFixed(
                      plan.commission_bps % 100 === 0 ? 0 : 1,
                    )}
                    % commission on sales
                  </Typography>
                </Box>
                <Typography
                  sx={{ fontWeight: 900, color: tokens.burgundy }}
                >
                  {formatPlanPrice(plan.monthly_fee_minor)}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 1,
              color: alpha(tokens.ink, 0.6),
            }}
          >
            Paid plans: we'll help you set up billing from your
            dashboard after signup.
          </Typography>
        </Box>
      ) : (
        <Box>
          <input type="hidden" name="plan_code" value="free" />
          <Typography
            sx={{ fontWeight: 800, color: alpha(tokens.ink, 0.8) }}
          >
            You're starting on the Free plan
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.5, color: alpha(tokens.ink, 0.62) }}
          >
            Go live for free and upgrade anytime from your dashboard.
          </Typography>
        </Box>
      )}

      {/* Last thing before submitting: "who sent you?". The value posts through
          the hidden affiliate_code input the form already carried — this just
          makes it reachable when the link's query string did not survive. */}
      <Box sx={{ mt: 3 }}>
        <TextField
          label="Referral code (optional)"
          value={affiliateCode}
          onChange={(event) =>
            // The API upper-cases and trims before matching; doing it here too
            // means the field shows exactly what will be submitted.
            onAffiliateCodeChange(event.target.value.toUpperCase().trim())
          }
          helperText={
            affiliateCodeFromLink
              ? "Applied from the link you followed. You can change it if you were given a different code."
              : "Were you referred by an Xtiitch affiliate? Enter their code so they get credited."
          }
          fullWidth
          slotProps={{
            htmlInput: {
              autoCapitalize: "characters",
              spellCheck: false,
              maxLength: 32,
              "aria-label": "Referral code",
            },
          }}
        />
      </Box>
    </Box>
  );
}
