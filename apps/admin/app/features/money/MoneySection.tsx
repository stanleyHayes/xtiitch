import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import SyncRounded from "@mui/icons-material/SyncRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import { tokens } from "../../theme";
import { Panel, SectionHeader, PaginationFooter } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import type { AdminMoneyRails } from "../../lib/api";
import { formatGHS, shortTime } from "../shared";
import { webhookColor, payoutColor } from "./utils";

export function MoneySection({
  moneyRails,
  moneyRailsError,
}: {
  moneyRails: AdminMoneyRails | null;
  moneyRailsError: string | null;
}) {
  const moneyWebhookEvents = moneyRails?.webhookEvents ?? [];
  const moneyPayoutReviews = moneyRails?.payoutReviews ?? [];
  const {
    page: webhookPage,
    pageCount: webhookPageCount,
    pagedItems: pagedMoneyWebhookEvents,
    setPage: setWebhookPage,
  } = usePagedItems(moneyWebhookEvents, 6, moneyWebhookEvents.length);
  const {
    page: payoutPage,
    pageCount: payoutPageCount,
    pagedItems: pagedMoneyPayoutReviews,
    setPage: setPayoutPage,
  } = usePagedItems(moneyPayoutReviews, 6, moneyPayoutReviews.length);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Paystack operations"
        title="Money rails"
        helper="Watch webhook delivery, split settlement, subaccount health, and payout holds without touching tenant funds."
      />
      {moneyRailsError ? (
        <Alert severity="warning">{moneyRailsError}</Alert>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "1.08fr 0.92fr" },
        }}
      >
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
            {pagedMoneyWebhookEvents.map((event) => {
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
            {moneyWebhookEvents.length === 0 ? (
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
              count={webhookPageCount}
              label="webhook events"
              page={webhookPage}
              pageSize={6}
              total={moneyWebhookEvents.length}
              onChange={setWebhookPage}
            />
          </Stack>
        </Panel>

        <Panel
          sx={{
            p: { xs: 2, md: 2.5 },
            borderColor: alpha(tokens.warning, 0.16),
            backgroundImage: `
              radial-gradient(circle at 92% 2%, ${alpha(tokens.warning, 0.14)}, transparent 34%),
              linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
            `,
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", mb: 2 }}
          >
            <AccountBalanceRounded sx={{ color: tokens.burgundy }} />
            <Box>
              <Typography variant="h6">Settlement review</Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
              >
                Subaccount status and operator holds.
              </Typography>
            </Box>
          </Stack>
          <Stack spacing={1.5}>
            {pagedMoneyPayoutReviews.map((review) => {
              const held = review.holdActive;
              const blockedByBusinessState =
                review.status === "blocked" && !review.holdActive;
              return (
                <Box
                  key={review.id}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: held
                      ? alpha(tokens.danger, 0.32)
                      : alpha(payoutColor(review.status), 0.2),
                    borderRadius: 1.5,
                    bgcolor: held
                      ? alpha(tokens.danger, 0.04)
                      : alpha(tokens.white, 0.72),
                    backgroundImage: `linear-gradient(90deg, ${alpha(
                      held ? tokens.danger : payoutColor(review.status),
                      0.075,
                    )}, transparent 38%)`,
                    transition:
                      "transform 180ms ease, border-color 180ms ease",
                    "&:hover": {
                      transform: "translateX(3px)",
                      borderColor: alpha(
                        held ? tokens.danger : payoutColor(review.status),
                        0.34,
                      ),
                    },
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>
                          {review.business}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {review.subaccountRef}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={held ? "held" : review.status}
                        sx={{
                          bgcolor: alpha(
                            held
                              ? tokens.danger
                              : payoutColor(review.status),
                            0.12,
                          ),
                          color: held
                            ? tokens.danger
                            : payoutColor(review.status),
                          textTransform: "capitalize",
                        }}
                      />
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">Settlement</Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 900 }}
                      >
                        {formatGHS(review.settlementMinor)}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">Commission</Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 900 }}
                      >
                        {formatGHS(review.commissionMinor)}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {review.nextAction}
                    </Typography>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="money:settlement-hold"
                      />
                      <input
                        type="hidden"
                        name="business_id"
                        value={review.id}
                      />
                      <input
                        type="hidden"
                        name="hold"
                        value={held ? "false" : "true"}
                      />
                      <input
                        type="hidden"
                        name="reason"
                        value={
                          held
                            ? "Operator released settlement review hold."
                            : review.nextAction
                        }
                      />
                      <Button
                        type="submit"
                        variant={held ? "contained" : "outlined"}
                        color={held ? "primary" : "error"}
                        size="small"
                        startIcon={
                          held ? (
                            <CheckCircleRounded />
                          ) : (
                            <BlockRounded />
                          )
                        }
                        disabled={blockedByBusinessState}
                      >
                        {blockedByBusinessState
                          ? "Blocked by status"
                          : held
                            ? "Release hold"
                            : "Place review hold"}
                      </Button>
                    </Form>
                  </Stack>
                </Box>
              );
            })}
            {moneyPayoutReviews.length === 0 ? (
              <Box
                sx={{
                  p: 2,
                  border: "1px dashed",
                  borderColor: alpha(tokens.warning, 0.28),
                  borderRadius: 1.5,
                  bgcolor: "rgba(var(--surface-rgb), 0.68)",
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  No settlement rows yet.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, color: "text.secondary" }}
                >
                  Verified stores with subaccounts or payment
                  activity will appear here for operator review.
                </Typography>
              </Box>
            ) : null}
            <PaginationFooter
              count={payoutPageCount}
              label="payout reviews"
              page={payoutPage}
              pageSize={6}
              total={moneyPayoutReviews.length}
              onChange={setPayoutPage}
            />
          </Stack>
        </Panel>
      </Box>
    </Stack>
  );
}
