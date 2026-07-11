import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";
import { AdminBusinessStatus, AdminVerificationStatus } from "./types";
import { statusColor } from "./colors";



export function StatusChip({
  status,
}: {
  status: AdminBusinessStatus | AdminVerificationStatus;
}) {
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        bgcolor: alpha(statusColor(status), 0.12),
        color: statusColor(status),
        border: "1px solid",
        borderColor: alpha(statusColor(status), 0.24),
        textTransform: "capitalize",
      }}
    />
  );
}
