import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function InlineEmptyState({
  icon,
  title,
  helper,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        border: "1px dashed",
        borderColor: (theme) =>
          alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.36 : 0.25,
          ),
        borderRadius: 2,
        textAlign: "center",
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(tokens.white, 0.035)
            : "rgba(var(--surface-rgb), 0.7)",
        backgroundImage: (theme) => {
          const tone = alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.12 : 0.045,
          );
          return `linear-gradient(135deg, ${tone}, transparent 48%)`;
        },
      }}
    >
      <Box
        sx={{
          color: "primary.main",
          mb: 0.85,
          mx: "auto",
          width: 52,
          height: 52,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
          border: "1px solid",
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.22),
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: 380, mx: "auto", mt: 0.5 }}
      >
        {helper}
      </Typography>
    </Box>
  );
}