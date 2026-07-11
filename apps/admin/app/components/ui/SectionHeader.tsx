import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";



export function SectionHeader({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper: string;
}) {
  return (
    <Stack
      spacing={0.5}
      sx={{
        position: "relative",
        pl: 2,
        py: 0.35,
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          width: 4,
          borderRadius: 6,
          bgcolor: tokens.burgundy,
          boxShadow: `0 10px 24px ${alpha(tokens.burgundy, 0.24)}`,
        },
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: "primary.main", fontWeight: 900 }}
      >
        {eyebrow}
      </Typography>
      <Typography variant="h5">{title}</Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 760 }}>
        {helper}
      </Typography>
    </Stack>
  );
}
