import { useState } from "react";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "../../components/form-text-field";
import type { AdminPlan } from "../shared/types";

function ghs(minor: number): string {
  return minor > 0 ? (minor / 100).toFixed(2) : "";
}

// Xtiitch bills per quarter or per year only. The monthly figure is a reference
// rate (displayed to owners, and used to classify upgrade vs downgrade) — it is
// never charged, so a quarter is three months of it by default.
const MONTHS_PER_QUARTER = 3;

function autoQuarterlyFrom(monthly: string): string {
  const parsed = Number.parseFloat(monthly);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "";
  }
  return (parsed * MONTHS_PER_QUARTER).toFixed(2);
}

const adornment = {
  input: {
    startAdornment: <InputAdornment position="start">GHS</InputAdornment>,
  },
  htmlInput: { min: 0, step: "0.01" },
} as const;

// The prices an admin can set for a plan. Entering the monthly rate
// auto-populates the quarterly first-cycle price (monthly x 3), but that value
// stays editable — once the admin types their own quarterly figure we stop
// overwriting it, so a deliberate override is never clobbered. `plan` is
// optional so the create-package form can reuse the same fields: absent a plan
// every input starts blank (ghs(0) is ""), and the auto-fill starts from
// whatever monthly rate the admin types.
export function PlanCadenceFields({ plan }: Readonly<{ plan?: AdminPlan }>) {
  const [monthly, setMonthly] = useState(ghs(plan?.monthlyFeeMinor ?? 0));
  const [quarterlyFirst, setQuarterlyFirst] = useState(
    ghs(plan?.cadence.quarterlyFirstMinor ?? 0),
  );
  const [quarterlyOverridden, setQuarterlyOverridden] = useState(
    (plan?.cadence.quarterlyFirstMinor ?? 0) > 0,
  );

  return (
    <>
      <TextField
        label="Monthly fee"
        name="monthly_fee_ghs"
        type="number"
        size="small"
        value={monthly}
        onChange={(event) => {
          const next = event.target.value;
          setMonthly(next);
          if (!quarterlyOverridden) {
            setQuarterlyFirst(autoQuarterlyFrom(next));
          }
        }}
        helperText="Reference rate — never charged"
        slotProps={adornment}
      />
      <TextField
        label="Quarterly price"
        name="quarterly_first_ghs"
        type="number"
        size="small"
        value={quarterlyFirst}
        onChange={(event) => {
          setQuarterlyFirst(event.target.value);
          setQuarterlyOverridden(true);
        }}
        helperText={
          quarterlyOverridden ? "Overridden" : "Auto: monthly x 3 — editable"
        }
        slotProps={adornment}
      />
      <TextField
        label="Quarterly renewal"
        name="quarterly_renewal_ghs"
        type="number"
        size="small"
        defaultValue={ghs(plan?.cadence.quarterlyRenewalMinor ?? 0)}
        helperText="Charged from cycle 2"
        slotProps={adornment}
      />
      <TextField
        label="Yearly price"
        name="yearly_first_ghs"
        type="number"
        size="small"
        defaultValue={ghs(plan?.cadence.yearlyFirstMinor ?? 0)}
        helperText="First year"
        slotProps={adornment}
      />
      <TextField
        label="Yearly renewal"
        name="yearly_renewal_ghs"
        type="number"
        size="small"
        defaultValue={ghs(plan?.cadence.yearlyRenewalMinor ?? 0)}
        helperText="Charged from year 2"
        slotProps={adornment}
      />
    </>
  );
}
