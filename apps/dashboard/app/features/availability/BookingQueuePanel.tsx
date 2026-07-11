import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import { tokens } from "../../theme";
import { BookingSummary } from "../shared/types";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import {
  shortDateTime,
  datetimeLocalValue,
  canManageBooking,
  bookingTone,
} from "../shared/utils";
import { ToneChip } from "../../components/ui/ToneChip";
import { InfoStrip } from "../studio/InfoStrip";
import { StyledDateTimeField } from "../../components/ui/StyledDateTimeField";
import { PaginationFooter } from "../../components/ui/PaginationFooter";

export function BookingQueuePanel({
  bookings,
  error,
}: {
  bookings: BookingSummary[];
  error?: string;
}) {
  const {
    page: bookingPage,
    pageCount: bookingPageCount,
    pagedItems: pagedBookings,
    setPage: setBookingPage,
  } = usePagedItems(bookings, 6, bookings.length);

  return (
    <Panel id="visits">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <CalendarMonthRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Visit queue</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Home-visit bookings, reschedule controls, and cancellations.
            </Typography>
          </Box>
        </Stack>
        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </Box>

      {bookings.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <InlineEmptyState
            icon={<EventAvailableRounded sx={{ fontSize: 38 }} />}
            title="No booked visits"
            helper="Customer home-visit bookings will appear here after checkout confirms the deposit."
          />
        </Box>
      ) : (
        <>
          {pagedBookings.map((booking) => {
            const manage = canManageBooking(booking.status);
            const canReschedule = booking.status === "booked";
            return (
              <Box
                key={booking.booking_id}
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.75,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }} noWrap>
                        {booking.customer_name || "Customer"} ·{" "}
                        {booking.design_title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {shortDateTime(booking.slot_start)} to{" "}
                        {shortDateTime(booking.slot_end)}
                      </Typography>
                    </Box>
                    <ToneChip
                      label={booking.status}
                      tone={bookingTone(booking.status)}
                    />
                  </Stack>
                  <InfoStrip
                    icon={<PhoneRounded />}
                    tone={tokens.info}
                    title={booking.customer_phone || "No phone captured"}
                    helper={booking.address || "No address captured"}
                  />
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    sx={{ alignItems: { xs: "stretch", md: "center" } }}
                  >
                    <Form method="post" style={{ flex: 1 }}>
                      <input
                        type="hidden"
                        name="intent"
                        value="reschedule_booking"
                      />
                      <input
                        type="hidden"
                        name="booking_id"
                        value={booking.booking_id}
                      />
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                      >
                        <StyledDateTimeField
                          name="slot_start"
                          label="New slot"
                          size="small"
                          defaultValue={datetimeLocalValue(booking.slot_start)}
                          disabled={!canReschedule}
                          fullWidth
                        />
                        <Button
                          type="submit"
                          variant="outlined"
                          disabled={!canReschedule}
                        >
                          Reschedule
                        </Button>
                      </Stack>
                    </Form>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="cancel_booking"
                      />
                      <input
                        type="hidden"
                        name="booking_id"
                        value={booking.booking_id}
                      />
                      <Button
                        type="submit"
                        color="error"
                        variant="outlined"
                        disabled={!manage}
                        fullWidth
                      >
                        Cancel
                      </Button>
                    </Form>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
          <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
            <PaginationFooter
              count={bookingPageCount}
              label="bookings"
              page={bookingPage}
              pageSize={6}
              total={bookings.length}
              onChange={setBookingPage}
            />
          </Box>
        </>
      )}
    </Panel>
  );
}