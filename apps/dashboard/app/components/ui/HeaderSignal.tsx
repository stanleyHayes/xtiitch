import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function HeaderSignal({
  icon,
  tone,
  title,
  helper,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  helper: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        p: 1.35,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(tokens.white, 0.15),
        bgcolor: "rgba(var(--surface-rgb), 0.085)",
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          color: tone,
          bgcolor: alpha(tone, 0.18),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 900,
            color: "common.white",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: alpha(tokens.white, 0.68), overflowWrap: "anywhere" }}
        >
          {helper}
        </Typography>
      </Box>
    </Stack>
  );
}