import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { tokens } from "../../theme";
import { OrderSummary, BookingSummary, HandoverSummary, FollowUpItem } from "../shared/types";
import { measurementSourceFor, countOrders } from "../orders/utils";
import {
  canManageBooking,
  canAdvanceHandover,
  handoverTone,
} from "../shared/utils";
import { Panel } from "../../components/ui/Panel";
import { MiniStat } from "../../components/ui/MiniStat";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { shortDateTime } from "../shared/utils";
import { formatMethod } from "../money/utils";
import { ToneChip } from "../../components/ui/ToneChip";

export function StaffTaskPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  orders,
  bookings,
  handovers,
  followUps,
  needsMeasurements,
  activeBookings,
  openHandovers,
  readyForHandover,
  pendingMessages,
}: {
  orders: OrderSummary[];
  bookings: BookingSummary[];
  handovers: HandoverSummary[];
  followUps: FollowUpItem[];
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  readyForHandover: number;
  pendingMessages: number;
}) {
  const visitMeasurements = orders.filter(
    (order) => measurementSourceFor(order) === "visit",
  ).length;
  const shopMeasurements = orders.filter(
    (order) => measurementSourceFor(order) === "shop",
  ).length;
  const nextBookings = bookings.filter((booking) =>
    canManageBooking(booking.status),
  );
  const nextHandovers = handovers.filter((handover) =>
    canAdvanceHandover(handover.status),
  );

  return (
    <Panel id="tasks">
      <Box sx={{ p: { xs: 2, md: 2.75 } }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", lg: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <TuneRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Staff task queue</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Move production, capture measurements, manage visits, and close
                pickup or delivery work.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              component={RouterLink}
              to="/dashboard/orders"
              size="small"
              variant="contained"
            >
              Orders
            </Button>
            <Button
              component={RouterLink}
              to="/dashboard/visits"
              size="small"
              variant="outlined"
            >
              Visits
            </Button>
            <Button
              component={RouterLink}
              to="/dashboard/handovers"
              size="small"
              variant="outlined"
            >
              Handovers
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <MiniStat
            icon={<TimelineRounded fontSize="small" />}
            label="In studio"
            value={String(countOrders(orders, "confirmed"))}
            helper="Confirmed orders ready to move"
            tone={tokens.info}
          />
          <MiniStat
            icon={<StraightenRounded fontSize="small" />}
            label="Measurements"
            value={String(needsMeasurements)}
            helper={`${visitMeasurements} visit, ${shopMeasurements} shop`}
            tone={tokens.burgundy}
          />
          <MiniStat
            icon={<CalendarMonthRounded fontSize="small" />}
            label="Visits"
            value={String(activeBookings)}
            helper="Held or booked home visits"
            tone={tokens.success}
          />
          <MiniStat
            icon={<LocalShippingRounded fontSize="small" />}
            label="Handovers"
            value={String(openHandovers)}
            helper={`${readyForHandover} fulfilled orders ready`}
            tone={tokens.warning}
          />
        </Box>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          }}
        >
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 1.75, py: 1.5, bgcolor: tokens.panel }}>
              <Typography sx={{ fontWeight: 900 }}>Next visits</Typography>
            </Box>
            {nextBookings.length === 0 ? (
              <Box sx={{ p: 1.75 }}>
                <InlineEmptyState
                  icon={<CalendarMonthRounded sx={{ fontSize: 34 }} />}
                  title="No active visits"
                  helper="Home visit work will appear here once customers book or hold a slot."
                />
              </Box>
            ) : (
              nextBookings.slice(0, 3).map((booking) => (
                <Box
                  key={booking.booking_id}
                  sx={{
                    px: 1.75,
                    py: 1.35,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {booking.customer_name || "Visit customer"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {shortDateTime(booking.slot_start)} · {booking.design_title}
                  </Typography>
                </Box>
              ))
            )}
          </Box>

          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 1.75, py: 1.5, bgcolor: tokens.panel }}>
              <Typography sx={{ fontWeight: 900 }}>Handover work</Typography>
            </Box>
            {nextHandovers.length === 0 ? (
              <Box sx={{ p: 1.75 }}>
                <InlineEmptyState
                  icon={<LocalShippingRounded sx={{ fontSize: 34 }} />}
                  title="No open handovers"
                  helper="Fulfilled garments waiting for pickup or delivery will appear here."
                />
              </Box>
            ) : (
              nextHandovers.slice(0, 3).map((handover) => (
                <Box
                  key={handover.handover_id}
                  sx={{
                    px: 1.75,
                    py: 1.35,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    alignItems: "center",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {handover.customer_name || "Handover customer"}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                      noWrap
                    >
                      {formatMethod(handover.method)} · {handover.design_title}
                    </Typography>
                  </Box>
                  <ToneChip
                    label={handover.status}
                    tone={handoverTone(handover.status)}
                  />
                </Box>
              ))
            )}
          </Box>
        </Box>

        {followUps.length > 0 || pendingMessages > 0 ? (
          <Box
            sx={{
              mt: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                px: 1.75,
                py: 1.5,
                bgcolor: tokens.panel,
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", sm: "center" },
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Follow-ups</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Open customer work that should not wait.
                </Typography>
              </Box>
              <ToneChip
                label={`${followUps.length} signals`}
                tone={followUps.length > 0 ? tokens.warning : tokens.success}
              />
            </Stack>
            {followUps.slice(0, 4).map((item) => (
              <Box
                key={item.id}
                sx={{
                  px: 1.75,
                  py: 1.35,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "minmax(0, 1fr) auto",
                  },
                  alignItems: "center",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {item.helper}
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  to={item.href}
                  size="small"
                  variant="outlined"
                >
                  {item.meta}
                </Button>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    </Panel>
  );
}
