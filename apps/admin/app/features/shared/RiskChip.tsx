import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";
import { AdminRiskLevel } from "./types";
import { riskColor } from "./colors";



export function RiskChip({ level }: { level: AdminRiskLevel }) {
  return (
    <Chip
      size="small"
      label={`${level} risk`}
      sx={{
        bgcolor: alpha(riskColor(level), 0.12),
        color: riskColor(level),
        border: "1px solid",
        borderColor: alpha(riskColor(level), 0.24),
        textTransform: "capitalize",
      }}
    />
  );
}
