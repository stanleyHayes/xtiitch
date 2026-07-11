import Box from "@mui/material/Box";
import type { AdminPlan } from "../../shared/types";
import { PlanCard } from "./PlanCard";

export function PlanCards({
  plans,
  plansError,
  pagedPlans,
  planDialogId,
  onPlanDialogChange,
}: {
  plans: AdminPlan[];
  plansError: string | null;
  pagedPlans: AdminPlan[];
  planDialogId: string | null;
  onPlanDialogChange: (planId: string | null) => void;
}) {
  if (plansError || plans.length === 0) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      {pagedPlans.map((plan) => (
        <PlanCard
          key={plan.planId}
          plan={plan}
          dialogOpen={planDialogId === plan.planId}
          onDialogChange={(open) =>
            onPlanDialogChange(open ? plan.planId : null)
          }
        />
      ))}
    </Box>
  );
}
