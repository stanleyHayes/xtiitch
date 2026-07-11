import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ display: "grid", placeItems: "center", textAlign: "center", py: { xs: 8, md: 12 }, px: 3 }}>
      <Box sx={{ maxWidth: 440 }}>
        <Box
          aria-hidden
          sx={{
            position: "relative",
            width: 104,
            height: 104,
            mx: "auto",
            mb: 3,
            display: "grid",
            placeItems: "center",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `radial-gradient(circle at 50% 38%, ${alpha(tokens.burgundy, 0.16)}, transparent 68%)`,
            },
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 6,
              borderRadius: "50%",
              border: `1px dashed ${alpha(tokens.ink, 0.18)}`,
            },
          }}
        >
          <Box
            sx={{
              width: 62,
              height: 62,
              borderRadius: "18px",
              display: "grid",
              placeItems: "center",
              color: tokens.white,
              background: `linear-gradient(150deg, ${tokens.wine}, ${tokens.ink})`,
              boxShadow: `0 16px 34px ${alpha(tokens.ink, 0.28)}`,
            }}
          >
            {icon ?? <SearchRounded sx={{ fontSize: 28 }} />}
          </Box>
        </Box>
        <Typography variant="h5" component="p" sx={{ fontWeight: 900, color: "text.primary", letterSpacing: -0.2 }}>
          {title}
        </Typography>
        {hint && (
          <Typography sx={{ mt: 1.25, color: "text.secondary", lineHeight: 1.6 }}>{hint}</Typography>
        )}
        {action && (
          <Stack direction="row" spacing={1.25} sx={{ mt: 3, justifyContent: "center", flexWrap: "wrap" }}>
            {action}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
