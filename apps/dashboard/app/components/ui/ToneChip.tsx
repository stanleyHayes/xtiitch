import type { ReactElement } from "react";
import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";

export function ToneChip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: string;
  icon?: ReactElement;
}) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={{
        bgcolor: alpha(tone, 0.1),
        color: tone,
        border: "1px solid",
        borderColor: alpha(tone, 0.22),
        "& .MuiChip-icon": { color: tone },
      }}
    />
  );
}