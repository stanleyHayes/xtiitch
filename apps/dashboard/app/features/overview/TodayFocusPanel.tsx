import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { tokens } from "../../theme";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";

export function TodayFocusPanel({
  pendingPayments,
  needsMeasurements,
  openHandovers,
  pendingMessages,
}: {
  pendingPayments: number;
  needsMeasurements: number;
  openHandovers: number;
  pendingMessages: number;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        bgcolor: tokens.charcoal,
        color: tokens.white,
        position: "relative",
        backgroundImage: `
          linear-gradient(${alpha(tokens.white, 0.045)} 1px, transparent 1px),
          linear-gradient(90deg, ${alpha(tokens.white, 0.045)} 1px, transparent 1px),
          linear-gradient(145deg, ${alpha(tokens.burgundy, 0.42)}, transparent 54%)
        `,
        backgroundSize: "34px 34px, 34px 34px, auto",
      }}
    >
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              color: tokens.white,
              bgcolor: alpha(tokens.burgundy, 0.58),
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.16),
              flexShrink: 0,
            }}
          >
            <TuneRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Today's focus</Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.75, color: alpha(tokens.white, 0.7) }}
            >
              Clear drafts first, capture visit/shop measurements, then close
              finished garments with pickup or delivery handovers. Xtiitch
              records payment state but never holds funds.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <ToneChip
            label={`${pendingPayments} payment follow-ups`}
            tone={tokens.warning}
          />
          <ToneChip
            label={`${needsMeasurements} measurement captures`}
            tone={tokens.info}
          />
          <ToneChip
            label={`${openHandovers} active handovers`}
            tone={tokens.warning}
          />
          <ToneChip
            label={`${pendingMessages} messages pending`}
            tone={tokens.burgundy}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Button
            component={RouterLink}
            to="/dashboard/orders?orders=draft"
            size="small"
            variant="contained"
            startIcon={<ReceiptLongRounded />}
            sx={{ bgcolor: "rgb(var(--surface-rgb))", color: "text.primary" }}
          >
            Drafts
          </Button>
          <Button
            component={RouterLink}
            to="/dashboard/visits"
            size="small"
            variant="outlined"
            startIcon={<CalendarMonthRounded />}
            sx={{
              color: tokens.white,
              borderColor: alpha(tokens.white, 0.22),
              "&:hover": { borderColor: alpha(tokens.white, 0.34) },
            }}
          >
            Visits
          </Button>
          <Button
            component={RouterLink}
            to="/dashboard/handovers"
            size="small"
            variant="outlined"
            startIcon={<LocalShippingRounded />}
            sx={{
              color: tokens.white,
              borderColor: alpha(tokens.white, 0.22),
              "&:hover": { borderColor: alpha(tokens.white, 0.34) },
            }}
          >
            Handovers
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}