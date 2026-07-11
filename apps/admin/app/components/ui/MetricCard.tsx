import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { Panel } from "./Panel";



export function MetricCard({
  label,
  value,
  helper,
  trend,
}: {
  label: string;
  value: string;
  helper: string;
  trend: string;
}) {
  return (
    <Panel
      sx={{
        p: 2.5,
        minHeight: 176,
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        borderColor: alpha(tokens.burgundy, 0.16),
        backgroundImage: `
          radial-gradient(circle at 88% 18%, ${alpha(tokens.warning, 0.18)} 0, transparent 30%),
          linear-gradient(135deg, ${alpha(tokens.burgundy, 0.1)}, transparent 48%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.74))
        `,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto auto 0",
          height: 3,
          width: "100%",
          bgcolor: tokens.burgundy,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          right: -22,
          bottom: -28,
          width: 104,
          height: 104,
          borderRadius: "50%",
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.12),
          // Theme-aware orb fill: matches the card surface so it reads as a soft
          // flourish on cream AND ink. (Was a hardcoded white halo that turned
          // into a harsh gray donut on dark.)
          boxShadow: "inset 0 0 0 18px rgba(var(--surface-rgb), 0.6)",
        },
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(tokens.burgundy, 0.28),
          boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.11)}`,
        },
      }}
    >
      <Stack spacing={1.2} sx={{ position: "relative", zIndex: 1, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 900,
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          {label}
        </Typography>
        <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "flex-end",
            justifyContent: "space-between",
            mt: "auto",
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", maxWidth: 180 }}
          >
            {helper}
          </Typography>
          <Chip
            size="small"
            label={trend}
            sx={{
              bgcolor: alpha(tokens.success, 0.12),
              color: tokens.success,
              border: "1px solid",
              borderColor: alpha(tokens.success, 0.22),
            }}
          />
        </Stack>
      </Stack>
    </Panel>
  );
}
