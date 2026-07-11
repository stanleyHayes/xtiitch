import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SaveRounded from "@mui/icons-material/SaveRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import { AvailabilityWindow } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { AvailabilityWindowFields } from "./AvailabilityWindowFields";
import { BlackoutDaysSection } from "./BlackoutDaysSection";

export function AvailabilityPanel({
  windows,
  blackouts,
  error,
}: {
  windows: AvailabilityWindow[];
  blackouts: string[];
  error?: string;
}) {
  // Recurring windows sort by weekday/time; one-off "date" windows sort by their
  // date so upcoming special hours read in order.
  const sortedWindows = [...windows].sort((a, b) => {
    if (a.recurrence === "date" || b.recurrence === "date") {
      return (a.specific_date ?? "").localeCompare(b.specific_date ?? "");
    }
    return a.weekday - b.weekday || a.start_minute - b.start_minute;
  });

  return (
    <Panel id="availability">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <ScheduleRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Visit hours</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Recurring windows and one-off dates that produce customer
              home-visit slots.
            </Typography>
          </Box>
        </Stack>
        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Form method="post">
          <input type="hidden" name="intent" value="save_availability" />
          <Stack spacing={1.25} sx={{ mt: 2 }}>
            {sortedWindows.map((window, index) => (
              <AvailabilityWindowFields
                key={`${window.recurrence}-${window.specific_date ?? ""}-${window.weekday}-${window.start_minute}-${index}`}
                window={window}
              />
            ))}
            {/* Re-key the blank add-row on the window count so it clears after
                a successful save. */}
            <AvailabilityWindowFields key={`add-${windows.length}`} />
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveRounded />}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              Save hours
            </Button>
          </Stack>
        </Form>
        <Divider sx={{ my: 2.5 }} />
        <BlackoutDaysSection blackouts={blackouts} />
      </Box>
    </Panel>
  );
}