import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { AvailabilitySlot } from "../../lib/api";
import {
  buildVisitMonthWeeks,
  formatVisitSlot,
  formatVisitTime,
  groupVisitSlots,
  visitDayKey,
  visitDayKeyParts,
  visitMonthIndex,
  visitMonthLabel,
  VISIT_WEEKDAY_LABELS,
  type VisitSlotGroup,
} from "./visit-slot-utils";

export function VisitSlotFields({ slots }: { slots: AvailabilitySlot[] }) { // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  const groups = useMemo(() => groupVisitSlots(slots), [slots]);
  const groupsByKey = useMemo(() => {
    const map = new Map<string, VisitSlotGroup>();
    groups.forEach((group) => map.set(group.key, group));
    return map;
  }, [groups]);
  // A day is available iff it has at least one open slot in the loader data.
  const availableDayKeys = useMemo(
    () => new Set(groups.map((group) => group.key)),
    [groups],
  );
  const todayKey = useMemo(() => visitDayKey(new Date()), []);
  // The visible month spans from the earliest to the latest month that holds an
  // open slot; paging is clamped to that window.
  const monthBounds = useMemo(() => {
    if (groups.length === 0) {
      return null;
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    groups.forEach((group) => {
      const { year, month } = visitDayKeyParts(group.key);
      const index = visitMonthIndex(year, month);
      min = Math.min(min, index);
      max = Math.max(max, index);
    });
    return { min, max };
  }, [groups]);

  const [selectedDay, setSelectedDay] = useState(groups[0]?.key ?? "");
  const [viewMonthIndex, setViewMonthIndex] = useState(monthBounds?.min ?? 0);
  const currentGroup = groupsByKey.get(selectedDay) ?? groups[0];
  const [selectedSlot, setSelectedSlot] = useState(
    currentGroup?.slots[0]?.slot_start ?? "",
  );
  const activeSlot =
    currentGroup?.slots.find((slot) => slot.slot_start === selectedSlot) ??
    currentGroup?.slots[0];

  if (groups.length === 0 || !currentGroup || !activeSlot || !monthBounds) {
    return (
      <Alert severity="info">
        No home-visit slots are open right now. Try self-measure or come to the
        shop.
      </Alert>
    );
  }

  const viewYear = Math.floor(viewMonthIndex / 12);
  const viewMonth = viewMonthIndex % 12;
  const weeks = buildVisitMonthWeeks(viewYear, viewMonth);
  const canGoPrev = viewMonthIndex > monthBounds.min;
  const canGoNext = viewMonthIndex < monthBounds.max;

  return (
    <>
      <input type="hidden" name="slot_start" value={activeSlot.slot_start} />
      <Box
        sx={{
          p: 1.5,
          borderRadius: "8px",
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.12),
          bgcolor: alpha(tokens.burgundy, 0.045),
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1,
          }}
        >
          <Typography sx={{ fontWeight: 900 }}>Choose visit day</Typography>
          <Stack
            direction="row"
            spacing={0.25}
            sx={{ alignItems: "center", flexShrink: 0 }}
          >
            <IconButton
              type="button"
              size="small"
              aria-label="Previous month"
              disabled={!canGoPrev}
              onClick={() =>
                setViewMonthIndex((index) =>
                  Math.max(monthBounds.min, index - 1),
                )
              }
              sx={{ color: tokens.burgundy }}
            >
              <ChevronLeftRounded fontSize="small" />
            </IconButton>
            <Typography
              sx={{
                fontWeight: 800,
                minWidth: 116,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {visitMonthLabel(viewYear, viewMonth)}
            </Typography>
            <IconButton
              type="button"
              size="small"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={() =>
                setViewMonthIndex((index) =>
                  Math.min(monthBounds.max, index + 1),
                )
              }
              sx={{ color: tokens.burgundy }}
            >
              <ChevronRightRounded fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 280 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 0.5,
                mb: 0.5,
              }}
            >
              {VISIT_WEEKDAY_LABELS.map((label) => (
                <Typography
                  key={label}
                  variant="caption"
                  sx={{
                    textAlign: "center",
                    fontWeight: 800,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {label}
                </Typography>
              ))}
            </Box>
            {weeks.map((week, weekIndex) => (
              <Box
                key={weekIndex}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 0.5,
                  mb: 0.5,
                }}
              >
                {week.map((dayKey, dayIndex) => { // eslint-disable-line complexity -- large presentational component; refactor in follow-up
                  if (!dayKey) {
                    return <Box key={`pad-${weekIndex}-${dayIndex}`} />;
                  }
                  const { day } = visitDayKeyParts(dayKey);
                  const isAvailable = availableDayKeys.has(dayKey);
                  const isPast = dayKey < todayKey;
                  const isSelected = dayKey === currentGroup.key;
                  const isDisabled = isPast || !isAvailable;
                  const group = groupsByKey.get(dayKey);
                  const slotCount = group?.slots.length ?? 0;
                  return (
                    <Button
                      key={dayKey}
                      type="button"
                      disableElevation
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedDay(dayKey);
                        setSelectedSlot(group?.slots[0]?.slot_start ?? "");
                      }}
                      aria-label={`${visitMonthLabel(viewYear, viewMonth)} ${day}${
                        isAvailable
                          ? `, ${slotCount} slot${slotCount === 1 ? "" : "s"} open`
                          : ", unavailable"
                      }`}
                      aria-pressed={isSelected}
                      sx={{
                        minWidth: 0,
                        p: 0,
                        height: 44,
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "3px",
                        textTransform: "none",
                        border: "1px solid",
                        color: isSelected
                          ? tokens.white
                          : isAvailable
                            ? tokens.burgundy
                            : "text.disabled",
                        bgcolor: isSelected
                          ? tokens.burgundy
                          : isAvailable
                            ? alpha(tokens.burgundy, 0.08)
                            : "transparent",
                        borderColor: isSelected
                          ? tokens.burgundy
                          : isAvailable
                            ? alpha(tokens.burgundy, 0.28)
                            : "transparent",
                        "&:hover": {
                          bgcolor: isSelected
                            ? tokens.burgundy
                            : alpha(tokens.burgundy, 0.16),
                          borderColor: alpha(tokens.burgundy, 0.4),
                        },
                        "&.Mui-disabled": {
                          color: alpha(tokens.ink, 0.3),
                          bgcolor: alpha(tokens.ink, 0.03),
                          borderColor: "transparent",
                          textDecoration: isPast ? "line-through" : "none",
                        },
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 800,
                          lineHeight: 1,
                          fontSize: "0.85rem",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {day}
                      </Typography>
                      <Box
                        sx={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          bgcolor:
                            isAvailable && !isSelected
                              ? tokens.burgundy
                              : isSelected
                                ? tokens.white
                                : "transparent",
                        }}
                      />
                    </Button>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>

        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.5 }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "4px",
                border: "1px solid",
                borderColor: alpha(tokens.burgundy, 0.28),
                bgcolor: alpha(tokens.burgundy, 0.08),
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Available
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "4px",
                bgcolor: alpha(tokens.ink, 0.08),
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Unavailable / fully booked
            </Typography>
          </Stack>
        </Stack>

        <Typography sx={{ fontWeight: 900, mt: 1.5, mb: 1 }}>
          {currentGroup.caption} times
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 0.75,
          }}
        >
          {currentGroup.slots.map((slot) => {
            const selected = slot.slot_start === activeSlot.slot_start;
            return (
              <Button
                key={slot.slot_start}
                type="button"
                variant={selected ? "contained" : "outlined"}
                onClick={() => setSelectedSlot(slot.slot_start)}
                sx={{
                  justifyContent: "flex-start",
                  textTransform: "none",
                  fontWeight: 900,
                }}
              >
                {formatVisitTime(slot)}
              </Button>
            );
          })}
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
          Selected: {formatVisitSlot(activeSlot)}
        </Typography>
      </Box>
      <TextField
        name="address"
        label="Visit address"
        placeholder="House number, street, area, and nearby landmark"
        required
        fullWidth
        multiline
        minRows={2}
      />
    </>
  );
}
