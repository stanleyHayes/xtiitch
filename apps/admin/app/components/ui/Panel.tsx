import type { ReactNode } from "react";
import Paper from "@mui/material/Paper";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import { tokens } from "../../theme";



export function Panel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: 2,
        bgcolor: "background.paper",
        boxShadow: `0 16px 44px ${alpha(tokens.ink, 0.055)}`,
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "adminSurfaceIn 420ms ease both",
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
