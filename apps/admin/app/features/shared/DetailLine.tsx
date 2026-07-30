import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function DetailLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 74,
        p: 1.25,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        borderRadius: 1.5,
        bgcolor: "rgba(var(--surface-rgb), 0.62)",
      }}
    >
      {icon ? (
        <Box
          aria-hidden="true"
          sx={{
            width: 38,
            height: 38,
            borderRadius: 1.25,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: tokens.burgundy,
            bgcolor: alpha(tokens.burgundy, 0.08),
            "& .MuiSvgIcon-root": { fontSize: 20 },
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Box sx={{ minWidth: 0 }}>
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
    </Box>
  );
}
