import { useEffect } from "react";
import { useMemo } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { splitDateTimeInputValue, splitDateParts, splitTimeParts, dayOptionsFor, optionListWithSelected, composeDateInputValue, composeTimeInputValue, composeDateTimeValue, yearOptionsFor } from "../../features/shared/utils";
import { defaultMinuteOptions, monthOptions, hourOptions, periodOptions } from "../../features/shared/constants";

export function StyledDateTimeField({
  name,
  label,
  defaultValue = "",
  required = false,
  disabled = false,
  size = "small",
  fullWidth = true,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  fullWidth?: boolean;
}) {
  const initial = splitDateTimeInputValue(defaultValue);
  const initialDate = splitDateParts(initial.date);
  const initialTime = splitTimeParts(initial.time);
  const [dateYear, setDateYear] = useState(initialDate.year);
  const [dateMonth, setDateMonth] = useState(initialDate.month);
  const [dateDay, setDateDay] = useState(initialDate.day);
  const [timeHour, setTimeHour] = useState(initialTime.hour);
  const [timeMinute, setTimeMinute] = useState(initialTime.minute);
  const [timePeriod, setTimePeriod] = useState<string>(initialTime.period);
  const dayOptions = useMemo(
    () => dayOptionsFor(dateYear, dateMonth),
    [dateYear, dateMonth],
  );
  const minuteOptions = useMemo(
    () => optionListWithSelected(defaultMinuteOptions, timeMinute),
    [timeMinute],
  );
  const dateValue = composeDateInputValue(dateYear, dateMonth, dateDay);
  const timeValue = composeTimeInputValue(timeHour, timeMinute, timePeriod);
  const hiddenValue = composeDateTimeValue(dateValue, timeValue);

  useEffect(() => {
    if (dateDay && !dayOptions.includes(dateDay)) {
      setDateDay("");
    }
  }, [dateDay, dayOptions]);

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
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: 0.75,
            gridTemplateColumns: { xs: "1fr 1fr", sm: "0.9fr 1fr 1.2fr" },
          }}
        >
          <TextField
            select
            label="Day"
            value={dateDay}
            onChange={(event) => setDateDay(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          >
            <MenuItem value="">Day</MenuItem>
            {dayOptions.map((day) => (
              <MenuItem key={day} value={day}>
                {day}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Month"
            value={dateMonth}
            onChange={(event) => setDateMonth(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
          >
            <MenuItem value="">Month</MenuItem>
            {monthOptions.map((month) => (
              <MenuItem key={month.value} value={month.value}>
                {month.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Year"
            value={dateYear}
            onChange={(event) => setDateYear(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
            sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
          >
            <MenuItem value="">Year</MenuItem>
            {yearOptionsFor(dateYear).map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 0.75,
            gridTemplateColumns: {
              xs: "1fr 1fr 0.9fr",
              sm: "0.9fr 0.9fr 0.8fr",
            },
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
            fullWidth={fullWidth}
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
            fullWidth={fullWidth}
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
            fullWidth={fullWidth}
          >
            <MenuItem value="">--</MenuItem>
            {periodOptions.map((period) => (
              <MenuItem key={period} value={period}>
                {period}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
    </StyledTemporalField>
  );
}

export const StyledTemporalField = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  const borderColor = dark ? alpha(tokens.white, 0.16) : alpha(tokens.ink, 0.1);
  const fieldBg = dark ? alpha(tokens.white, 0.07) : tokens.white;
  const fieldHoverBg = dark ? alpha(tokens.white, 0.1) : tokens.white;
  const labelColor = dark
    ? alpha(tokens.white, 0.72)
    : theme.palette.text.secondary;

  return {
    border: `1px solid ${borderColor}`,
    borderRadius: 20,
    background: dark
      ? `linear-gradient(180deg, ${alpha(tokens.white, 0.075)}, ${alpha(tokens.white, 0.035)})`
      : `linear-gradient(180deg, rgba(var(--surface-rgb), 0.96), rgba(var(--surface-rgb), 0.78))`,
    padding: theme.spacing(0.9),
    boxShadow: dark ? `inset 0 1px 0 ${alpha(tokens.white, 0.08)}` : "none",
    transition:
      "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
    "&:focus-within": {
      borderColor: alpha(theme.palette.primary.main, dark ? 0.76 : 0.42),
      boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, dark ? 0.2 : 0.1)}`,
    },
    "&[data-disabled='true']": {
      opacity: 0.56,
    },
    "& .MuiFormLabel-root": {
      color: labelColor,
      fontWeight: 800,
      "&.Mui-focused": {
        color: dark ? tokens.white : theme.palette.primary.main,
      },
    },
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      backgroundColor: fieldBg,
      color: theme.palette.text.primary,
      "&:hover": {
        backgroundColor: fieldHoverBg,
      },
      "&.Mui-focused": {
        backgroundColor: fieldHoverBg,
      },
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? alpha(tokens.white, 0.18) : alpha(tokens.ink, 0.12),
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? alpha(tokens.white, 0.28) : alpha(tokens.ink, 0.22),
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.primary.main,
    },
    "& .MuiInputBase-input": {
      color: theme.palette.text.primary,
      fontWeight: 800,
      letterSpacing: 0,
    },
    "& .MuiSelect-select": {
      color: theme.palette.text.primary,
      fontWeight: 800,
      letterSpacing: 0,
    },
    "& .MuiSelect-icon": {
      color: dark ? alpha(tokens.white, 0.72) : alpha(tokens.burgundy, 0.68),
    },
    "& .MuiInputAdornment-root .MuiSvgIcon-root": {
      color: dark ? theme.palette.primary.main : alpha(tokens.burgundy, 0.78),
    },
  };
}) as typeof Box;