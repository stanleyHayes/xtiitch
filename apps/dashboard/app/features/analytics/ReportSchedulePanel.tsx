import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import ScheduleSendRounded from "@mui/icons-material/ScheduleSendRounded";
import { tokens } from "../../theme";
import {
  EXPORT_FORMAT_LABELS,
  analyticsLevel,
  exportFormats,
  scheduleCadences,
  scheduledReportsLevel,
} from "../../lib/entitlements";
import { shortDateTime } from "../shared/utils";
import TextField from "../../components/form-text-field";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import type { Profile } from "../shared/types";
import type { ReportSchedule } from "./types";

// §14.1 "Scheduled / auto-generated reports (emailed)" — Growth gets a monthly
// summary, Studio any cadence (the scheduled_reports matrix row: 1 = monthly
// only, 2 = any). One schedule per store; saving replaces it (PUT semantics).
// §1.2: the form re-mounts from the revalidated schedule after a successful
// save — the `key` forces fresh defaults instead of stale DOM state.
export function ReportSchedulePanel({ // eslint-disable-line complexity -- presentational form with per-field schedule defaults
  profile,
  schedule,
  error,
}: {
  profile: Profile;
  schedule: ReportSchedule | null;
  error?: string;
}) {
  const limits = profile.entitlement_limits;
  const cadences = scheduleCadences(limits);
  const formats = exportFormats(profile.entitlements);
  const level = analyticsLevel(limits);
  if (scheduledReportsLevel(limits) < 1) {
    return null;
  }
  const reportKinds = [
    { value: "financial", label: "Financial records" },
    { value: "sales", label: "Sales report" },
    // The full suite needs analytics_level 2+ — Growth already qualifies.
    ...(level >= 2 ? [{ value: "full", label: "Full report suite" }] : []),
  ];

  return (
    <Panel id="analytics-schedule">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <ScheduleSendRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Scheduled reports</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Get a report emailed automatically
                {cadences.length === 1 ? " every month." : " on your cadence."}
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={
              schedule?.last_sent_at
                ? `Last sent ${shortDateTime(schedule.last_sent_at)}`
                : schedule?.enabled
                  ? `On · ${schedule.cadence}`
                  : "Not scheduled"
            }
            tone={schedule?.enabled ? tokens.success : tokens.mutedText}
          />
        </Stack>

        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Stack
          component={Form}
          method="post"
          key={JSON.stringify(schedule ?? "unset")}
          spacing={1.5}
          sx={{ mt: 2 }}
        >
          <input type="hidden" name="intent" value="save_report_schedule" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              select
              name="report"
              label="Report"
              size="small"
              fullWidth
              defaultValue={schedule?.report ?? "financial"}
            >
              {reportKinds.map((kind) => (
                <MenuItem key={kind.value} value={kind.value}>
                  {kind.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              name="format"
              label="Format"
              size="small"
              fullWidth
              defaultValue={schedule?.format ?? formats[0] ?? "csv"}
            >
              {formats.map((format) => (
                <MenuItem key={format} value={format}>
                  {EXPORT_FORMAT_LABELS[format]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              name="cadence"
              label="Cadence"
              size="small"
              fullWidth
              defaultValue={schedule?.cadence ?? cadences[0] ?? "monthly"}
            >
              {cadences.map((cadence) => (
                <MenuItem key={cadence} value={cadence}>
                  {cadence.charAt(0).toUpperCase() + cadence.slice(1)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            name="email"
            label="Email to receive it"
            type="email"
            size="small"
            fullWidth
            defaultValue={schedule?.email ?? ""}
            required
          />
          <FormControlLabel
            control={
              <Switch name="enabled" defaultChecked={schedule?.enabled ?? true} />
            }
            label="Enabled — email the report automatically"
          />
          <Box>
            <Button type="submit" variant="contained">
              Save schedule
            </Button>
          </Box>
        </Stack>
      </Box>
    </Panel>
  );
}
