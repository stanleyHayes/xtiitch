import { useState } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { AvailabilityWindow } from "../shared/types";
import { weekdays } from "../shared/constants";
import { StyledTimeField } from "../../components/ui/StyledTimeField";
import { minutesToTime } from "../shared/utils";

export function AvailabilityWindowFields({ window }: { window?: AvailabilityWindow }) { // eslint-disable-line complexity -- large presentational component; refactor in follow-up
  const [recurrence, setRecurrence] = useState(window?.recurrence ?? "weekly");
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        p: { xs: 1.5, sm: 1.75 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(tokens.white, 0.13)
            : alpha(tokens.ink, 0.08),
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(tokens.white, 0.045)
            : alpha(tokens.panel, 0.5),
        backgroundImage: (theme) =>
          theme.palette.mode === "dark"
            ? `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.12)}, transparent 46%)`
            : "none",
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? `inset 0 1px 0 ${alpha(tokens.white, 0.06)}`
            : "none",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          alignItems: "start",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "minmax(0, 1fr) minmax(0, 1fr) 136px",
          },
        }}
      >
        <TextField
          name="recurrence"
          label="Repeats"
          select
          size="small"
          value={recurrence}
          onChange={(event) => setRecurrence(event.target.value)}
        >
          <MenuItem value="daily">Every day</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
          <MenuItem value="ongoing">Ongoing</MenuItem>
          <MenuItem value="date">One-off date</MenuItem>
        </TextField>
        {/* Weekday (weekly), day-of-month (monthly), and specific date (one-off)
            stay mounted but hidden when not in use, so the submitted field arrays
            stay aligned by row. */}
        <TextField
          name="weekday"
          label="Day of week"
          select
          size="small"
          defaultValue={window?.weekday ?? 1}
          sx={{ display: recurrence === "weekly" ? "block" : "none" }}
        >
          {weekdays.map((weekday) => (
            <MenuItem key={weekday.value} value={weekday.value}>
              {weekday.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="day_of_month"
          label="Day of month"
          type="number"
          size="small"
          defaultValue={window?.day_of_month ?? 1}
          slotProps={{ htmlInput: { min: 1, max: 31 } }}
          sx={{ display: recurrence === "monthly" ? "block" : "none" }}
        />
        <TextField
          name="specific_date"
          label="Date"
          type="date"
          size="small"
          defaultValue={window?.specific_date ?? ""}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ display: recurrence === "date" ? "block" : "none" }}
        />
        <TextField
          name="slot_minutes"
          label="Slot (min)"
          type="number"
          size="small"
          defaultValue={window?.slot_minutes ?? 60}
          slotProps={{ htmlInput: { min: 15, max: 480, step: 15 } }}
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          alignItems: "start",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <StyledTimeField
          name="start"
          label="Start time"
          size="small"
          defaultValue={window ? minutesToTime(window.start_minute) : ""}
        />
        <StyledTimeField
          name="end"
          label="End time"
          size="small"
          defaultValue={window ? minutesToTime(window.end_minute) : ""}
        />
      </Box>
    </Box>
  );
}
