import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../theme";

export function RegisterStepIndicator({
  step,
  labels,
}: {
  step: number;
  labels: string[];
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
      {labels.map((label, i) => (
        <Box key={label} sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              height: 5,
              borderRadius: 999,
              bgcolor: i <= step ? tokens.burgundy : alpha(tokens.ink, 0.12),
              transition: "background-color 240ms ease",
            }}
          />
          <Typography
            variant="caption"
            noWrap
            sx={{
              mt: 0.75,
              display: "block",
              fontWeight: i === step ? 800 : 600,
              color: i <= step ? tokens.burgundy : alpha(tokens.ink, 0.55),
            }}
          >
            {i + 1}. {label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
