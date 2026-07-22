import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

// Responsive presentation branches are intentionally kept in one reusable primitive.
// eslint-disable-next-line complexity
export function AdminEmptyState({
  icon,
  eyebrow = "Nothing here yet",
  title,
  helper,
  action,
  compact = false,
}: Readonly<{
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  helper: string;
  action?: ReactNode;
  compact?: boolean;
}>) {
  return (
    <Box
      role="status"
      sx={{
        position: "relative",
        overflow: "hidden",
        p: compact ? { xs: 2, md: 2.5 } : { xs: 3, md: 4 },
        border: "1px dashed",
        borderColor: alpha(tokens.burgundy, 0.28),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.8)",
        backgroundImage: `radial-gradient(circle at 90% 10%, ${alpha(
          tokens.burgundy,
          0.12,
        )}, transparent 30%), linear-gradient(135deg, ${alpha(
          tokens.info,
          0.055,
        )}, transparent 48%)`,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: compact ? "row" : "column" }}
        spacing={compact ? 2 : 1.5}
        sx={{
          position: "relative",
          alignItems: compact ? { xs: "flex-start", sm: "center" } : "center",
          textAlign: compact ? "left" : "center",
        }}
      >
        <Box
          sx={{
            width: compact ? 48 : 58,
            height: compact ? 48 : 58,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 2,
            color: "primary.main",
            bgcolor: alpha(tokens.burgundy, 0.09),
            border: "1px solid",
            borderColor: alpha(tokens.burgundy, 0.18),
            "& svg": { fontSize: compact ? 25 : 30 },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: "primary.main", fontWeight: 900, letterSpacing: 1.1 }}
          >
            {eyebrow}
          </Typography>
          <Typography variant={compact ? "h6" : "h5"}>{title}</Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 0.5,
              color: "text.secondary",
              lineHeight: 1.65,
              maxWidth: compact ? 620 : 520,
              mx: compact ? 0 : "auto",
            }}
          >
            {helper}
          </Typography>
        </Box>
        {action ? (
          <Box sx={{ flexShrink: 0, mt: compact ? 0 : 0.5 }}>{action}</Box>
        ) : null}
      </Stack>
    </Box>
  );
}
