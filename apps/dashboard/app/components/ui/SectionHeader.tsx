import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function SectionHeader({
  eyebrow,
  title,
  helper,
  action,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      sx={{
        justifyContent: "space-between",
        alignItems: { xs: "flex-start", md: "flex-end" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", fontWeight: 800 }}
        >
          {eyebrow}
        </Typography>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        <Typography sx={{ mt: 0.5, color: "text.secondary", maxWidth: 720 }}>
          {helper}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}