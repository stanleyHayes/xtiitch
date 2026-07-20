import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DateRangeRounded from "@mui/icons-material/DateRangeRounded";
import TextField from "../../components/form-text-field";
import { Panel } from "../../components/ui/Panel";

// §14.1 Studio "Custom date ranges": the only plan that may re-window the
// analytics endpoints. Submits GET so the range rides the URL (shareable,
// SSR-friendly) and the loader applies it to every entitled endpoint. §1.2
// reset is the "Full history" link — it navigates back to the bare section.
export function CustomRangePanel({
  range,
}: {
  range: { from: string; to: string };
}) {
  return (
    <Panel id="analytics-range">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <DateRangeRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Custom date range</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Studio only: re-window every chart and total below.
            </Typography>
          </Box>
        </Stack>
        <Stack
          component={Form}
          method="get"
          action="/dashboard/analytics"
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          sx={{ mt: 2, alignItems: { sm: "flex-end" } }}
        >
          <TextField
            name="from"
            label="From"
            type="date"
            size="small"
            defaultValue={range.from}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            name="to"
            label="To"
            type="date"
            size="small"
            defaultValue={range.to}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button type="submit" variant="contained" sx={{ flexShrink: 0 }}>
            Apply
          </Button>
          <Button
            component="a"
            href="/dashboard/analytics"
            variant="text"
            sx={{ flexShrink: 0 }}
          >
            Full history
          </Button>
        </Stack>
      </Box>
    </Panel>
  );
}
