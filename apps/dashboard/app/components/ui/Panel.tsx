import type { ReactNode } from "react";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";
import type { SxProps } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { tokens } from "../../theme";

export function Panel({
  children,
  sx,
  id,
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
  id?: string;
}) {
  return (
    <Paper
      id={id}
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.96)",
        backgroundImage: `linear-gradient(180deg, rgba(var(--surface-rgb), 0.78), rgba(var(--surface-rgb), 0.5))`,
        boxShadow: `0 18px 54px ${alpha(tokens.ink, 0.07)}`,
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        backdropFilter: "blur(10px)",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "dashboardSurfaceIn 420ms ease both",
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}