import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SyncRounded from "@mui/icons-material/SyncRounded";
import type { AdminMoneyWebhookEvent } from "../../../lib/api";
import { tokens } from "../../../theme";
import { Panel } from "../../../components/ui";
import { PaginationFooter } from "../../../components/ui";
import { formatGHS, shortTime } from "../../shared";
import { webhookColor } from "../utils";

export function MoneyRailsPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  events,
  pagedEvents,
  page,
  pageCount,
  onPageChange,
}: {
  events: AdminMoneyWebhookEvent[];
  pagedEvents: AdminMoneyWebhookEvent[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.info, 0.16),
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", mb: 2 }}
      >
        <SyncRounded sx={{ color: tokens.burgundy }} />
        <Box>
          <Typography variant="h6">Webhook ledger</Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary" }}
          >
            Verified events, failed lookups, and safe replays.
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={1.5}>
        {pagedEvents.map((event) => {
          const replayed = event.status === "replayed";
          return (
            <Box
              key={event.id}
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: alpha(
                  replayed ? tokens.info : webhookColor(event.status),
                  0.2,
                ),
                borderRadius: 1.5,
                bgcolor: "rgba(var(--surface-rgb), 0.7)",
                backgroundImage: `linear-gradient(90deg, ${alpha(
                  replayed ? tokens.info : webhookColor(event.status),
                  0.075,
                )}, transparent 36%)`,
                transition:
                  "transform 180ms ease, border-color 180ms ease",
                "&:hover": {
                  transform: "translateX(3px)",
                  borderColor: alpha(
                    replayed ? tokens.info : webhookColor(event.status),
                    0.34,
                  ),
                },
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      {event.providerReference}
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        replayed ? "replay queued" : event.status
                      }
                      sx={{
                        bgcolor: alpha(
                          replayed ? tokens.info : webhookColor(event.status),
                          0.12,
                        ),
                        color: replayed
                          ? tokens.info
                          : webhookColor(event.status),
                        textTransform: "capitalize",
                      }}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mt: 0.5 }}
                  >
                    {event.business} · {event.purpose} ·{" "}
                    {formatGHS(event.amountMinor)} · {event.attempts} attempts
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {event.note}
                  </Typography>
                </Box>
                <Stack
                  spacing={1}
                  sx={{ alignItems: { md: "flex-end" } }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 800,
                    }}
                  >
                    {shortTime(event.receivedAt)}
                  </Typography>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="money:webhook-replay"
                    />
                    <input
                      type="hidden"
                      name="provider_reference"
                      value={event.providerReference}
                    />
                    <input
                      type="hidden"
                      name="reason"
                      value={event.note}
                    />
                    <Button
                      type="submit"
                      variant="outlined"
                      size="small"
                      startIcon={<SyncRounded />}
                      disabled={
                        event.status === "verified" || replayed
                      }
                    >
                      {replayed ? "Queued" : "Replay"}
                    </Button>
                  </Form>
                  {event.status === "verified" ? (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="money:payment-reversal"
                      />
                      <input
                        type="hidden"
                        name="provider_reference"
                        value={event.providerReference}
                      />
                      <input
                        type="hidden"
                        name="reason"
                        value="Refund or dispute confirmed by provider."
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        color="warning"
                        size="small"
                      >
                        Reverse
                      </Button>
                    </Form>
                  ) : null}
                </Stack>
              </Stack>
            </Box>
          );
        })}
        {events.length === 0 ? (
          <Box
            sx={{
              p: 2,
              border: "1px dashed",
              borderColor: alpha(tokens.info, 0.28),
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb), 0.68)",
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>
              No provider events yet.
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Paystack webhook deliveries will appear here after
              checkout confirmations reach the API.
            </Typography>
          </Box>
        ) : null}
        <PaginationFooter
          count={pageCount}
          label="webhook events"
          page={page}
          pageSize={6}
          total={events.length}
          onChange={onPageChange}
        />
      </Stack>
    </Panel>
  );
}
