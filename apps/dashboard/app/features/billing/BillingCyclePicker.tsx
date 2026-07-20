import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { subscriptionCharge } from "../../lib/billing-fees";
import type { BillingCadence, PublicPlan } from "./billing-helpers";
import { formatPrice, vatNote } from "./PaymentMethodForm";

// The "Choose your billing cycle" block of the payment screen. Every total it
// shows is the FULL checkout figure — package + Tax (VAT) + Transaction fee —
// computed with the §4.6 gross-up rule so what the owner reads here matches
// what Paystack charges; the selected cycle also itemises the three lines
// (§4.1/§4.5).
export function BillingCyclePicker({
  plan,
  cadence,
  onChange,
}: {
  plan: PublicPlan;
  cadence: BillingCadence;
  onChange: (cadence: BillingCadence) => void;
}) {
  return (
    <Box sx={{ textAlign: "left" }}>
      <Typography sx={{ fontWeight: 800, mb: 1 }}>
        Choose your billing cycle
      </Typography>
      <RadioGroup
        name="billing_cadence"
        value={cadence}
        onChange={(event) => onChange(event.target.value as BillingCadence)}
      >
        <Stack spacing={1.5}>
          {(["yearly", "quarterly"] as BillingCadence[]).map((option) => {
            const first = subscriptionCharge(
              option === "quarterly"
                ? plan.quarterly_first_minor
                : plan.yearly_first_minor,
              plan.vat_rate_bps,
              plan.vat_inclusive,
            );
            const renewal = subscriptionCharge(
              option === "quarterly"
                ? plan.quarterly_renewal_minor
                : plan.yearly_renewal_minor,
              plan.vat_rate_bps,
              plan.vat_inclusive,
            );
            const selected = cadence === option;
            return (
              <Paper
                key={option}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  borderColor: selected
                    ? tokens.burgundy
                    : alpha(tokens.ink, 0.16),
                  borderWidth: selected ? 2 : 1,
                  bgcolor: selected
                    ? alpha(tokens.burgundy, 0.04)
                    : "transparent",
                }}
              >
                <FormControlLabel
                  value={option}
                  control={<Radio />}
                  sx={{
                    m: 0,
                    width: "100%",
                    alignItems: "flex-start",
                  }}
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {option === "quarterly" ? "Quarterly" : "Yearly"} —{" "}
                        {formatPrice(first.totalMinor)}{" "}
                        {option === "quarterly"
                          ? "first 3 months"
                          : "first year"}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: alpha(tokens.ink, 0.68) }}
                      >
                        then {formatPrice(renewal.totalMinor)}/
                        {option === "quarterly" ? "quarter" : "year"}
                      </Typography>
                      {selected ? (
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            mt: 0.5,
                            color: alpha(tokens.ink, 0.6),
                          }}
                        >
                          {formatPrice(first.packageMinor)} package +{" "}
                          {formatPrice(first.vatMinor)} Tax (VAT) +{" "}
                          {formatPrice(first.transactionFeeMinor)} Transaction
                          fee
                        </Typography>
                      ) : null}
                    </Box>
                  }
                />
              </Paper>
            );
          })}
        </Stack>
      </RadioGroup>
      {vatNote(plan) ? (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 1,
            color: alpha(tokens.ink, 0.6),
          }}
        >
          {vatNote(plan)}
        </Typography>
      ) : null}
      <Divider sx={{ mt: 2 }} />
    </Box>
  );
}
