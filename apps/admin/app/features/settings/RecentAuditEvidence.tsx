import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import { tokens } from "../../theme";
import { AuditEvent, Section } from "../shared/types";
import { auditColor } from "../shared/colors";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";

export function RecentAuditEvidence({
  events,
  onSelect,
}: {
  events: AuditEvent[];
  onSelect: (section: Section) => void;
}) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center" }}
        >
          <HistoryRounded sx={{ color: tokens.burgundy }} />
          <Box>
            <Typography variant="h6">Recent audit evidence</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Latest durable operator events.
            </Typography>
          </Box>
        </Stack>
        <Divider />
        {events.map((event) => {
          const color = auditColor(event.severity);
          return (
            <Box
              key={event.id}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: alpha(color, 0.16),
                bgcolor: alpha(color, 0.045),
              }}
            >
              <Stack spacing={0.5}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography sx={{ fontWeight: 900 }}>
                    {event.action}
                  </Typography>
                  <Chip
                    size="small"
                    label={event.severity}
                    sx={{
                      bgcolor: alpha(color, 0.12),
                      color,
                      textTransform: "capitalize",
                    }}
                  />
                </Stack>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                >
                  {event.actor} · {shortTime(event.createdAt)}
                </Typography>
              </Stack>
            </Box>
          );
        })}
        {events.length === 0 ? (
          <Alert severity="info">No audit events are visible yet.</Alert>
        ) : null}
        <Button
          variant="outlined"
          startIcon={<HistoryRounded />}
          onClick={() => onSelect("audit")}
        >
          Open audit log
        </Button>
      </Stack>
    </Panel>
  );
}
