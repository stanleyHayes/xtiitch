import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function InfoStrip({
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
        borderColor: alpha(tone, 0.18),
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tone, 0.075)}, transparent 52%)`,
        minWidth: 0,
        boxShadow: `0 10px 26px ${alpha(tokens.ink, 0.04)}`,
      }}
    >
      <Box
        sx={{
          color: tone,
          width: 34,
          height: 34,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(tone, 0.1),
          border: "1px solid",
          borderColor: alpha(tone, 0.16),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
        >
          {helper}
        </Typography>
      </Box>
    </Stack>
  );
}