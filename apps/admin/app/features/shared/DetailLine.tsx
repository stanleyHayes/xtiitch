import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";



export function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ justifyContent: "space-between", gap: 2 }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 800, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}
