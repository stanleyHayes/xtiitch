import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";



export function PlanStatTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 800 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{ fontWeight: 950, overflowWrap: "anywhere", lineHeight: 1.2 }}
      >
        {value}
      </Typography>
      {helper ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {helper}
        </Typography>
      ) : null}
    </Box>
  );
}
