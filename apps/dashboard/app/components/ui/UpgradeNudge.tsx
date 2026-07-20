import { Link as RouterLink } from "react-router";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import { tokens } from "../../theme";
import { Panel } from "./Panel";

// §14.2/§15.2: gated tiers render an upgrade nudge instead of hiding silently —
// every locked panel names what the plan would unlock and where to get it. This
// is the Panel-scale version of PlanGatedControl's lock row, for whole section
// blocks (charts, breakdowns, insights) rather than single form controls.
export function UpgradeNudge({
  icon,
  title,
  description,
  requiredPlan,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  requiredPlan: string;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2.25, md: 3 },
        borderStyle: "dashed",
        backgroundImage: (theme) =>
          `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.1 : 0.05)}, transparent 55%)`,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
      >
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: "primary.main",
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
            <LockRounded sx={{ fontSize: 15, color: tokens.gold }} />
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mt: 0.5, lineHeight: 1.7 }}
          >
            {description}
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/onboarding/billing"
          variant="outlined"
          size="small"
          sx={{ flexShrink: 0 }}
        >
          Upgrade to {requiredPlan}
        </Button>
      </Stack>
    </Panel>
  );
}
