import { Form, useSearchParams } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SyncRounded from "@mui/icons-material/SyncRounded";
import WebhookRounded from "@mui/icons-material/WebhookRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { AdminMoneyWebhookEvent } from "../../../lib/api";
import { tokens } from "../../../theme";
import { Panel } from "../../../components/ui";
import { PaginationFooter } from "../../../components/ui";
import { AdminEmptyState } from "../../../components/ui";
import { AdminRecordPage } from "../../../components/ui";
import { formatGHS, shortTime } from "../../shared";
import { webhookColor } from "../utils";

// eslint-disable-next-line max-lines-per-function -- large presentational component; refactor in follow-up
export function MoneyRailsPanel({
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
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = events.find((event) => event.id === searchParams.get("webhook")) ?? null;
  const close = () => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("webhook"); return next; });
  if (selected) {
    const replayed = selected.status === "replayed";
    const color = replayed ? tokens.info : webhookColor(selected.status);
    return (
      <AdminRecordPage eyebrow="Webhook event" title={selected.business} helper={`${selected.purpose} · received ${shortTime(selected.receivedAt)}`} status={replayed ? "replay queued" : selected.status} statusColor={color} onBack={close}
        actions={<><Form method="post"><input type="hidden" name="intent" value="money:webhook-replay" /><input type="hidden" name="provider_reference" value={selected.providerReference} /><input type="hidden" name="reason" value={selected.note} /><Button type="submit" variant="outlined" startIcon={<SyncRounded />} disabled={selected.status === "verified" || replayed}>{replayed ? "Queued" : "Replay"}</Button></Form>{selected.status === "verified" ? <Form method="post"><input type="hidden" name="intent" value="money:payment-reversal" /><input type="hidden" name="provider_reference" value={selected.providerReference} /><input type="hidden" name="reason" value="Refund or dispute confirmed by provider." /><Button type="submit" variant="outlined" color="warning">Reverse</Button></Form> : null}</>}>
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.3fr) minmax(280px, .7fr)" } }}><Box><Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 900 }}>Provider result</Typography><Typography sx={{ mt: 1, fontSize: 18 }}>{selected.note}</Typography><Typography variant="body2" sx={{ mt: 2, color: "text.secondary", overflowWrap: "anywhere" }}>Reference: {selected.providerReference}</Typography></Box><Stack spacing={1} sx={{ p: 2, border: "1px solid", borderColor: alpha(color, .2), borderRadius: 2, bgcolor: alpha(color, .06) }}><Typography variant="overline" sx={{ color, fontWeight: 900 }}>Event snapshot</Typography><Typography sx={{ fontWeight: 900 }}>{formatGHS(selected.amountMinor)}</Typography><Typography variant="body2" sx={{ color: "text.secondary" }}>{selected.attempts} delivery attempt{selected.attempts === 1 ? "" : "s"}</Typography></Stack></Box>
      </AdminRecordPage>
    );
  }
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.info, 0.16),
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <SyncRounded sx={{ color: tokens.burgundy }} />
        <Box>
          <Typography variant="h6">Webhook ledger</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Verified events, failed lookups, and safe replays.
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={1.5}>
        {pagedEvents.map((event) => {
          const replayed = event.status === "replayed";
          return (
            <Box component="button" type="button" onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("webhook", event.id); return next; })}
              key={event.id}
              sx={{
                width: "100%",
                p: 1.5,
                border: "1px solid",
                borderColor: alpha(
                  replayed ? tokens.info : webhookColor(event.status),
                  0.2,
                ),
                borderRadius: 1.5,
                bgcolor: "rgba(var(--surface-rgb), 0.7)",
                color: "text.primary",
                textAlign: "left",
                font: "inherit",
                cursor: "pointer",
                backgroundImage: `linear-gradient(90deg, ${alpha(
                  replayed ? tokens.info : webhookColor(event.status),
                  0.075,
                )}, transparent 36%)`,
                transition: "transform 180ms ease, border-color 180ms ease",
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
                      label={replayed ? "replay queued" : event.status}
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
                  <Typography variant="body2" sx={{ mt: 1, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.note}</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 800,
                    }}
                  >
                    {shortTime(event.receivedAt)}
                  </Typography>
                  <ArrowForwardRounded sx={{ color: replayed ? tokens.info : webhookColor(event.status) }} />
                </Stack>
              </Stack>
            </Box>
          );
        })}
        {events.length === 0 ? (
          <AdminEmptyState
            compact
            icon={<WebhookRounded />}
            eyebrow="Webhook ledger"
            title="No provider events received"
            helper="Verified Paystack deliveries, failed lookups, and replay requests will appear here after checkout confirmations reach the API."
          />
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
