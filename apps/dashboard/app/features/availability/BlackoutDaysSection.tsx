import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EventBusyRounded from "@mui/icons-material/EventBusyRounded";
import TextField from "../../components/form-text-field";

export function BlackoutDaysSection({ blackouts }: { blackouts: string[] }) {
  const sorted = [...blackouts].sort((a, b) => a.localeCompare(b));
  return (
    <Box>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ color: "primary.main" }}>
          <EventBusyRounded />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>Blocked-out days</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Close a specific day so no home visits can be booked on it.
          </Typography>
        </Box>
      </Stack>
      <Form method="post">
        <input type="hidden" name="intent" value="mark_blackout" />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ mt: 2, alignItems: { sm: "center" } }}
        >
          <TextField
            name="date"
            label="Day to block"
            type="date"
            size="small"
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            type="submit"
            variant="outlined"
            startIcon={<EventBusyRounded />}
            sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
          >
            Block this day
          </Button>
        </Stack>
      </Form>
      {sorted.length > 0 ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 2 }}>
          {sorted.map((date) => (
            <Stack
              key={date}
              direction="row"
              spacing={0.5}
              sx={{
                alignItems: "center",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 999,
                pl: 1.25,
                pr: 0.5,
                py: 0.25,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {date}
              </Typography>
              <Form method="post">
                <input type="hidden" name="intent" value="clear_blackout" />
                <input type="hidden" name="date" value={date} />
                <Button type="submit" size="small" color="inherit">
                  Reopen
                </Button>
              </Form>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography
          variant="body2"
          sx={{ mt: 2, color: "text.secondary" }}
        >
          No days are blocked out in the next few months.
        </Typography>
      )}
    </Box>
  );
}