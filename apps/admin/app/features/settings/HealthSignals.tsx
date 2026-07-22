import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import { AdminReportItem, Section } from "../shared/types";
import { reportStatusColor } from "../shared/colors";
import { Panel } from "../../components/ui/Panel";

export function HealthSignals({ signals, onSelect }: { signals: AdminReportItem[]; onSelect: (section: Section) => void; }) {
  return <Panel sx={{ overflow: "hidden" }}>{signals.map((signal, index) => { const color = reportStatusColor(signal.status); return <Box key={signal.id} component="button" type="button" onClick={() => onSelect(signal.target)} sx={{ width: "100%", p: { xs: 2, md: 2.25 }, display: "grid", gridTemplateColumns: { xs: "auto 1fr auto", md: "auto minmax(0, 1.25fr) minmax(120px, .35fr) minmax(180px, .4fr) auto" }, gap: 1.5, alignItems: "center", border: 0, borderBottom: index === signals.length - 1 ? 0 : "1px solid", borderColor: "divider", bgcolor: "transparent", color: "text.primary", textAlign: "left", cursor: "pointer", font: "inherit", "&:hover": { bgcolor: alpha(color, .055) } }}>
    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: alpha(color, .11), color }}><SyncRounded /></Box>
    <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 900 }}>{signal.label}</Typography><Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signal.helper}</Typography></Box>
    <Typography sx={{ display: { xs: "none", md: "block" }, fontWeight: 900 }}>{signal.value}</Typography>
    <Chip size="small" label={signal.status} sx={{ display: { xs: "none", md: "flex" }, width: "fit-content", bgcolor: alpha(color, .11), color, textTransform: "capitalize" }} />
    <Stack direction="row" spacing={.75} sx={{ alignItems: "center" }}><Typography variant="caption" sx={{ display: { xs: "none", xl: "block" }, color, fontWeight: 900, whiteSpace: "nowrap" }}>{signal.targetLabel}</Typography><ArrowForwardRounded sx={{ color }} /></Stack>
  </Box>; })}</Panel>;
}
