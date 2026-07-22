import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 74,
        p: 1.25,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        borderRadius: 1.5,
        bgcolor: "rgba(var(--surface-rgb), 0.62)",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: "block",
          color: "text.secondary",
          fontWeight: 800,
          letterSpacing: 0.35,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          mt: 0.45,
          fontWeight: 900,
          lineHeight: 1.35,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
