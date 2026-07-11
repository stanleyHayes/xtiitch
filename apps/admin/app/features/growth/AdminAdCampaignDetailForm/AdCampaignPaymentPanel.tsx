import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import TextField from "../../../components/form-text-field";
import { tokens } from "../../../theme";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import { adCampaignPaymentStatusColor } from "../utils";
import type { AdminAdCampaign } from "../../../lib/api";

export function AdCampaignPaymentPanel({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  campaign,
}: {
  campaign: AdminAdCampaign;
}) {
  const archived = campaign.status === "archived";
  const paidMinor = campaign.payments.reduce(
    (total, payment) =>
      total + (payment.status === "paid" ? payment.amountMinor : 0),
    0,
  );
  const dueMinor = Math.max(campaign.budgetMinor - paidMinor, 0);
  const openPayment = campaign.payments.find(
    (payment) => payment.status === "initiated",
  );
  const latestPayments = campaign.payments.slice(0, 3);

  return (
    <Stack spacing={1.5}>
      {campaign.description || campaign.reviewNote ? (
        <Box
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.08),
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.7)",
          }}
        >
          {campaign.description ? (
            <Typography sx={{ overflowWrap: "anywhere" }}>
              {campaign.description}
            </Typography>
          ) : null}
          {campaign.reviewNote ? (
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Review: {campaign.reviewNote}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      <Box
        sx={{
          p: 1.5,
          border: "1px solid",
          borderColor: alpha(
            openPayment
              ? tokens.warning
              : dueMinor > 0
                ? tokens.info
                : tokens.success,
            0.18,
          ),
          borderRadius: 1.5,
          bgcolor: "rgba(var(--surface-rgb), 0.72)",
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
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PaymentsRounded sx={{ color: tokens.burgundy }} />
              <Box>
                <Typography variant="subtitle1">
                  Payment collection
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {dueMinor > 0
                    ? `${formatGHS(dueMinor)} still due for this placement.`
                    : "Booked budget has been collected."}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={
                  openPayment
                    ? "Payment link open"
                    : dueMinor > 0
                      ? "Awaiting collection"
                      : "Paid"
                }
                sx={{
                  bgcolor: alpha(
                    openPayment
                      ? tokens.warning
                      : dueMinor > 0
                        ? tokens.info
                        : tokens.success,
                    0.12,
                  ),
                  color: openPayment
                    ? tokens.warning
                    : dueMinor > 0
                      ? tokens.info
                      : tokens.success,
                  fontWeight: 900,
                }}
              />
              {openPayment?.paymentUrl ? (
                <Button
                  component="a"
                  href={openPayment.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowForwardRounded />}
                >
                  Open link
                </Button>
              ) : null}
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, 1fr)",
              },
            }}
          >
            <DetailLine label="Collected" value={formatGHS(paidMinor)} />
            <DetailLine label="Due" value={formatGHS(dueMinor)} />
            <DetailLine
              label="Open"
              value={
                openPayment
                  ? `${formatGHS(openPayment.amountMinor)} · ${openPayment.providerReference}`
                  : "No open link"
              }
            />
          </Box>

          {latestPayments.length > 0 ? (
            <Stack spacing={0.75}>
              {latestPayments.map((payment) => {
                const paymentColor = adCampaignPaymentStatusColor(
                  payment.status,
                );
                return (
                  <Stack
                    key={payment.paymentId}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      alignItems: {
                        xs: "flex-start",
                        sm: "center",
                      },
                      justifyContent: "space-between",
                      p: 1,
                      border: "1px solid",
                      borderColor: alpha(tokens.ink, 0.08),
                      borderRadius: 1,
                      bgcolor: "rgba(var(--surface-rgb), 0.56)",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 900,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {payment.providerReference}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {formatGHS(payment.amountMinor)} ·{" "}
                        {shortTime(payment.updatedAt)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={payment.status}
                      sx={{
                        bgcolor: alpha(paymentColor, 0.12),
                        color: paymentColor,
                        fontWeight: 900,
                        textTransform: "capitalize",
                      }}
                    />
                  </Stack>
                );
              })}
            </Stack>
          ) : null}

          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-ad-campaign-payment:collect"
            />
            <input
              type="hidden"
              name="campaign_id"
              value={campaign.campaignId}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Advertiser email"
                name="customer_email"
                size="small"
                type="email"
                placeholder="Defaults to business owner"
                fullWidth
                disabled={archived || Boolean(openPayment) || dueMinor <= 0}
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<PaymentsRounded />}
                disabled={archived || Boolean(openPayment) || dueMinor <= 0}
                sx={{ minWidth: { sm: 170 } }}
              >
                Collect payment
              </Button>
            </Stack>
          </Form>
        </Stack>
      </Box>
    </Stack>
  );
}
