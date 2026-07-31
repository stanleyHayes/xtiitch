import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { Plan } from "../../content";

export function PlanCardHeader({
  accent,
  index,
  plan,
  subtitle,
  title,
}: {
  accent: string;
  index: number;
  plan: Plan;
  subtitle: string;
  title: string;
}) {
  return (
    <Stack sx={{ gap: 1.25 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Typography
          variant="caption"
          sx={{ color: accent, fontWeight: 950, letterSpacing: "0.12em" }}
        >
          {String(index + 1).padStart(2, "0")}
        </Typography>
        {plan.badge ? (
          <Box
            component="span"
            sx={{
              px: 1,
              py: 0.45,
              borderRadius: 1.25,
              color: accent,
              bgcolor: alpha(accent, 0.1),
              fontSize: 11,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {plan.badge}
          </Box>
        ) : null}
      </Stack>
      <Box>
        <Typography variant="h4" component="h3" sx={{ fontSize: 24 }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mt: 0.35, color: "text.secondary", fontWeight: 750 }}
        >
          {subtitle}
        </Typography>
      </Box>
    </Stack>
  );
}
