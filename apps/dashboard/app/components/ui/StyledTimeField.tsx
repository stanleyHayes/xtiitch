import { useMemo } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import TextField from "../../components/form-text-field";
import { splitTimeParts, optionListWithSelected, composeTimeInputValue } from "../../features/shared/utils";
import { defaultMinuteOptions, hourOptions, periodOptions } from "../../features/shared/constants";
import { StyledTemporalField } from "./StyledDateTimeField";

export function StyledTimeField({
  name,
  label,
  defaultValue = "",
  required = false,
  disabled = false,
  size = "small",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
}) {
  const initialTime = splitTimeParts(defaultValue);
  const [timeHour, setTimeHour] = useState(initialTime.hour);
  const [timeMinute, setTimeMinute] = useState(initialTime.minute);
  const [timePeriod, setTimePeriod] = useState<string>(initialTime.period);
  const minuteOptions = useMemo(
    () => optionListWithSelected(defaultMinuteOptions, timeMinute),
    [timeMinute],
  );
  const hiddenValue = composeTimeInputValue(timeHour, timeMinute, timePeriod);

  return (
    <StyledTemporalField data-disabled={disabled ? "true" : undefined}>
      <input
        type="hidden"
        name={name}
        value={hiddenValue}
        disabled={disabled}
      />
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block", mb: 0.5 }}
      >
        {label}
        {required ? " *" : ""}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 0.75,
          gridTemplateColumns: { xs: "1fr 1fr 0.9fr", sm: "0.9fr 0.9fr 0.8fr" },
        }}
      >
        <TextField
          select
          label="Hour"
          value={timeHour}
          onChange={(event) => setTimeHour(event.target.value)}
          required={required}
          disabled={disabled}
          size={size}
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <ScheduleRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        >
          <MenuItem value="">Hour</MenuItem>
          {hourOptions.map((hour) => (
            <MenuItem key={hour} value={hour}>
              {hour}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Minute"
          value={timeMinute}
          onChange={(event) => setTimeMinute(event.target.value)}
          required={required}
          disabled={disabled}
          size={size}
          fullWidth
        >
          <MenuItem value="">Minute</MenuItem>
          {minuteOptions.map((minute) => (
            <MenuItem key={minute} value={minute}>
              {minute}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="AM/PM"
          value={timePeriod}
          onChange={(event) => setTimePeriod(event.target.value)}
          required={required}
          disabled={disabled}
          size={size}
          fullWidth
        >
          <MenuItem value="">--</MenuItem>
          {periodOptions.map((period) => (
            <MenuItem key={period} value={period}>
              {period}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </StyledTemporalField>
  );
}