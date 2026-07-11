import Typography from "@mui/material/Typography";
import { Panel } from "../../components/ui/Panel";



export function CustomerStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Panel sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
        {helper}
      </Typography>
    </Panel>
  );
}
