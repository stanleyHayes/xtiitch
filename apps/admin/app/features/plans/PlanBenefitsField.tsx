import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PLAN_BENEFITS } from "../../lib/api";



// PlanBenefitsField renders the predefined benefit catalogue as a checkbox set the
// admin ticks when building a package. Each checked box submits its key under the
// multi-value `features` form field.
export function PlanBenefitsField({ selected }: { selected?: string[] }) {
  const granted = new Set(selected ?? []);
  return (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
        Package benefits
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Storefront customizations this package unlocks. Businesses on a plan
        without a benefit see it locked with an upgrade prompt.
      </Typography>
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {PLAN_BENEFITS.map((benefit) => (
          <FormControlLabel
            key={benefit.key}
            sx={{ alignItems: "flex-start", m: 0 }}
            control={
              <Checkbox
                name="features"
                value={benefit.key}
                defaultChecked={granted.has(benefit.key)}
                size="small"
                sx={{ pt: 0.25 }}
              />
            }
            label={
              <Box sx={{ py: 0.25 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                  {benefit.label}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {benefit.description}
                </Typography>
              </Box>
            }
          />
        ))}
      </Stack>
    </Box>
  );
}
