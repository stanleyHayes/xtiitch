import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { Panel } from "./Panel";

export function EmptyState({
  icon,
  title,
  helper,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 3, md: 5 },
        textAlign: "center",
        borderStyle: "dashed",
        borderColor: alpha(tokens.burgundy, 0.25),
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.05)}, transparent 48%)`,
      }}
    >
      <Box
        sx={{
          color: "primary.main",
          mb: 1.25,
          width: 58,
          height: 58,
          mx: "auto",
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(tokens.burgundy, 0.08),
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.16),
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      <Typography
        variant="body2"
        sx={{ mt: 0.5, color: "text.secondary", maxWidth: 420, mx: "auto" }}
      >
        {helper}
      </Typography>
    </Panel>
  );
}