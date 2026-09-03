import { Form } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../../components/form-text-field";
import { tokens } from "../../../theme";
import { affiliateConversionActions } from "../../shared/actionErrors";
import { formatGHS } from "../../shared/formatting";
import { shortID, shortTime } from "../../shared/dates";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
} from "../../../lib/api";

// Commission-status wording the operator sees. "held" is an administrative
// hold placed on one suspicious commission; "pending" with a holdUntil date is
// the ordinary maturity window, which is a different thing entirely.
function conversionStatusLabel(
  conversion: AdminAffiliateAttribution["recentConversions"][number],
): string {
  if (conversion.status === "held") {
    return conversion.holdPlacedAt
      ? `Held ${shortTime(conversion.holdPlacedAt)}`
      : "Held";
  }
  if (conversion.status === "pending" && conversion.holdUntil) {
    return `Maturing ${shortTime(conversion.holdUntil)}`;
  }
  if (conversion.status === "approved") return "Available";
  if (conversion.status === "settled") return "Paid";
  return conversion.status;
}

// eslint-disable-next-line max-lines-per-function -- large presentational component; refactor in follow-up
export function AffiliateConversionsPanel({
  affiliate,
  performance,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
}) {
	const [statusFilter, setStatusFilter] = useState("all");
	const [query, setQuery] = useState("");
	const [fromDate, setFromDate] = useState("");
	const archived = affiliate.status === "archived";
  const approvedConversionCount = performance?.approvedConversionCount ?? 0;
  const recentApprovedCommissionMinor =
    performance?.recentConversions
      .filter((conversion) => conversion.status === "approved")
      .reduce((total, conversion) => total + conversion.commissionMinor, 0) ??
    0;
  const conversions = (performance?.recentConversions ?? []).filter((conversion) => {
    const search = query.trim().toLowerCase();
    return (statusFilter === "all" || conversion.status === statusFilter) &&
      (!search || [conversion.businessName, conversion.businessHandle, conversion.paymentReference].some((value) => value?.toLowerCase().includes(search))) &&
      (!fromDate || conversion.createdAt.slice(0, 10) >= fromDate);
  });

  return (
    <Stack spacing={1.5}>
      {performance?.recentConversions.length ? (
        <Box
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.info, 0.14),
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.7)",
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 900 }}
          >
            Commission history
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
            <TextField size="small" label="Business, handle or payment" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ flex: 1 }} />
            <TextField select size="small" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Available</MenuItem>
              <MenuItem value="settled">Paid</MenuItem>
              <MenuItem value="held">Held</MenuItem>
              <MenuItem value="reversed">Reversed / adjusted</MenuItem>
            </TextField>
            <TextField size="small" type="date" label="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {conversions.map((conversion) => {
              const actions = affiliateConversionActions(
                conversion.status,
                conversion.conversionType,
              );
              return (
                <Stack
                  key={conversion.conversionId}
                  spacing={1}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: "rgba(var(--surface-rgb), 0.76)",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "center" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }}>
                        {conversion.businessName || "Unknown business"}{conversion.businessHandle ? ` · @${conversion.businessHandle}` : ""}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {conversion.orderId
                          ? shortID(conversion.orderId)
                          : `Plan ${shortID(conversion.subscriptionId ?? "")}`}{" "}
                        · {conversion.attributionModel.replace("_", " ")}
						{conversion.payoutBatchId ? ` · Payout ${shortID(conversion.payoutBatchId)}` : ""}
                      </Typography>
                      {conversion.status === "held" && conversion.holdReason ? (
                        <Typography variant="body2" sx={{ color: "warning.main" }}>
                          Hold reason: {conversion.holdReason}
                          {conversion.preHoldStatus ? ` · releases to ${conversion.preHoldStatus}` : ""}
                        </Typography>
                      ) : null}
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <Chip
                        size="small"
                        label={conversionStatusLabel(conversion)}
                        variant="outlined"
                      />
                      <Typography sx={{ fontWeight: 900 }}>
                        {formatGHS(conversion.commissionMinor)}
                      </Typography>
                    </Stack>
                  </Stack>
                  {actions.length ? (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="admin-affiliate-conversion:update"
                      />
                      <input
                        type="hidden"
                        name="conversion_id"
                        value={conversion.conversionId}
                      />
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ alignItems: { sm: "center" } }}
                      >
                        <TextField
                          label="Reason (required to hold or release)"
                          name="reason"
                          size="small"
                          sx={{ flex: 1 }}
                        />
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ flexWrap: "wrap" }}
                        >
                          {actions.map((action) => (
                            <Tooltip key={action.status} title={action.label}><IconButton
                              type="submit"
                              name="status"
                              value={action.status}
                              size="small"
                              aria-label={action.label}
                              color={action.status === "reversed" ? "error" : "primary"}
                            >
                              {action.status === "approved" ? <CheckCircleRounded /> : action.status === "settled" ? <PaymentsRounded /> : <UndoRounded />}
                            </IconButton></Tooltip>
                          ))}
                        </Stack>
                      </Stack>
                    </Form>
                  ) : null}
                </Stack>
              );
            })}
            {!conversions.length ? <Typography variant="body2" color="text.secondary">No commissions match these filters.</Typography> : null}
          </Stack>
        </Box>
      ) : null}

      {approvedConversionCount > 0 && !archived ? (
        <Box
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.success, 0.18),
            borderRadius: 1,
            bgcolor: alpha(tokens.success, 0.06),
          }}
        >
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-affiliate-payout:create"
            />
            <input
              type="hidden"
              name="affiliate_id"
              value={affiliate.affiliateId}
            />
            <Stack spacing={1}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { sm: "center" },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>
                    Approved payout
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {approvedConversionCount} rows ·{" "}
                    {formatGHS(recentApprovedCommissionMinor)}
                  </Typography>
                  {affiliate.payoutMode === "paystack_transfer" ? (
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Send through Paystack to{" "}
                      {affiliate.payoutReference || "the Affiliate's recipient"}
                      , then record the returned TRF reference.
                    </Typography>
                  ) : null}
                </Box>
                <Tooltip title="Record completed payout"><IconButton type="submit" aria-label="Record completed payout" color="success"><PaymentsRounded /></IconButton></Tooltip>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "minmax(0, 1fr) minmax(0, 1.2fr)",
                  },
                }}
              >
                <TextField
                  label="Payout reference"
                  name="payout_reference"
                  size="small"
                  defaultValue=""
                  placeholder="TRF_..."
                />
                <TextField
                  label="Notes"
                  name="notes"
                  size="small"
                  defaultValue="Settled from approved affiliate commission."
                />
              </Box>
            </Stack>
          </Form>
        </Box>
      ) : null}
    </Stack>
  );
}
