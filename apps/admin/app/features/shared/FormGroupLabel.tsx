import type { ReactNode } from "react";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";



export function FormGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: alpha(tokens.ink, 0.55),
        mt: 1.75,
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}
