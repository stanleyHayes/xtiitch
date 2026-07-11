import type { AdminAdCampaign, AdminBusiness } from "../../lib/api";
import { adPlacementOptions, adCampaignStatusOptions } from "./options";
import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { formatGHS, formatPercentBps } from "../shared/formatting";
import { datetimeLocalDefault, shortTime } from "../shared/dates";
import { DetailLine } from "../shared/DetailLine";
import { adCampaignPaymentStatusColor } from "./utils";
import { moneyInputDefault } from "../shared/validation";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";



export function AdminAdCampaignDetailForm({
  campaign,
  eligibleBusinesses,
}: {
  campaign: AdminAdCampaign;
  eligibleBusinesses: AdminBusiness[];
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
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
        }}
      >
        <DetailLine label="Target" value={campaign.targetLabel} />
        <DetailLine
          label="Budget"
          value={`${formatGHS(paidMinor)} collected / ${formatGHS(
            campaign.budgetMinor,
          )} booked`}
        />
        <DetailLine
          label="Daily cap"
          value={
            typeof campaign.dailyCapMinor === "number"
              ? formatGHS(campaign.dailyCapMinor)
              : "No cap"
          }
        />
        <DetailLine
          label="Window"
          value={`${shortTime(campaign.startsAt)} - ${shortTime(
            campaign.endsAt,
          )}`}
        />
        <DetailLine
          label="Impressions"
          value={`${campaign.impressionCount} views`}
        />
        <DetailLine
          label="Clicks"
          value={`${campaign.clickCount} · ${formatPercentBps(
            campaign.clickRateBps,
          )}`}
        />
      </Box>

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

        <Form method="post">
          <input type="hidden" name="intent" value="admin-ad-campaign:update" />
          <input type="hidden" name="campaign_id" value={campaign.campaignId} />
          <input type="hidden" name="pricing_model" value="flat_time" />
          <Stack spacing={1.25}>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
              }}
            >
              <TextField
                select
                label="Business"
                name="business_id"
                size="small"
                defaultValue={campaign.businessId}
                disabled={archived}
              >
                {!eligibleBusinesses.some(
                  (business) => business.id === campaign.businessId,
                ) ? (
                  <MenuItem value={campaign.businessId}>
                    {campaign.businessName} · {campaign.businessHandle}
                  </MenuItem>
                ) : null}
                {eligibleBusinesses.map((business) => (
                  <MenuItem key={business.id} value={business.id}>
                    {business.name} · {business.handle}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Placement"
                name="placement_type"
                size="small"
                defaultValue={campaign.placementType}
                disabled={archived}
              >
                {adPlacementOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Target ref"
                name="target_ref_id"
                size="small"
                defaultValue={campaign.targetRefId}
                disabled={archived}
              />
              <TextField
                select
                label="Status"
                name="status"
                size="small"
                defaultValue={
                  campaign.status === "archived" ? "paused" : campaign.status
                }
                disabled={archived}
              >
                {adCampaignStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Headline"
                name="headline"
                size="small"
                defaultValue={campaign.headline}
                required
                disabled={archived}
              />
              <TextField
                label="Budget"
                name="budget_ghs"
                type="number"
                size="small"
                defaultValue={moneyInputDefault(campaign.budgetMinor)}
                disabled={archived}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { min: 0, step: "0.01" },
                }}
              />
              <TextField
                label="Daily cap"
                name="daily_cap_ghs"
                type="number"
                size="small"
                defaultValue={moneyInputDefault(campaign.dailyCapMinor)}
                disabled={archived}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { min: 0, step: "0.01" },
                }}
              />
              <StyledDateTimeField
                label="Starts"
                name="starts_at"
                size="small"
                defaultValue={datetimeLocalDefault(campaign.startsAt)}
                required
                disabled={archived}
              />
              <StyledDateTimeField
                label="Ends"
                name="ends_at"
                size="small"
                defaultValue={datetimeLocalDefault(campaign.endsAt)}
                required
                disabled={archived}
              />
            </Box>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              }}
            >
              <TextField
                label="Description"
                name="description"
                multiline
                minRows={2}
                size="small"
                defaultValue={campaign.description}
                disabled={archived}
              />
              <TextField
                label="Review note"
                name="review_note"
                multiline
                minRows={2}
                size="small"
                defaultValue={campaign.reviewNote}
                disabled={archived}
              />
            </Box>
            <Button
              type="submit"
              variant="contained"
              disabled={archived}
              sx={{ alignSelf: "flex-start" }}
            >
              Save placement
            </Button>
          </Stack>
        </Form>

        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value="admin-ad-campaign:archive"
          />
          <input type="hidden" name="campaign_id" value={campaign.campaignId} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Archive reason"
              name="reason"
              size="small"
              placeholder="Placement completed"
              fullWidth
              disabled={archived}
            />
            <Button
              type="submit"
              variant="outlined"
              color="warning"
              disabled={archived}
              sx={{ minWidth: { sm: 140 } }}
            >
              Archive
            </Button>
          </Stack>
        </Form>
      </Stack>
    </Stack>
  );
}
