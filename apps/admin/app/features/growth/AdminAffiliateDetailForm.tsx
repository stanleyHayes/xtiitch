import type { AdminAffiliate, AdminAffiliateAttribution } from "../../lib/api";
import { affiliateEntityOptions, affiliateCommissionOptions, affiliatePayoutOptions, affiliateStatusOptions } from "./options";
import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { affiliateConversionActions } from "../shared/actionErrors";
import { formatGHS } from "../shared/formatting";
import { shortID, shortTime } from "../shared/dates";
import { DetailLine } from "../shared/DetailLine";
import { affiliateCommissionDefault, affiliateCommissionLabel, affiliatePayoutLabel } from "./utils";



export function AdminAffiliateDetailForm({
  affiliate,
  performance,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
}) {
  const archived = affiliate.status === "archived";
  const approvedConversionCount = performance?.approvedConversionCount ?? 0;
  const recentApprovedCommissionMinor =
    performance?.recentConversions
      .filter((conversion) => conversion.status === "approved")
      .reduce((total, conversion) => total + conversion.commissionMinor, 0) ??
    0;
  const lastPayout = performance?.recentPayouts[0];
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
        }}
      >
        <DetailLine
          label="Commission"
          value={affiliateCommissionLabel(affiliate)}
        />
        <DetailLine
          label="Cookie window"
          value={`${affiliate.cookieWindowDays} days`}
        />
        <DetailLine
          label="Payout mode"
          value={affiliatePayoutLabel(affiliate.payoutMode)}
        />
        <DetailLine
          label="Contact"
          value={affiliate.email || affiliate.phone || "No contact"}
        />
        <DetailLine
          label="Tracked clicks"
          value={String(performance?.clickCount ?? 0)}
        />
        <DetailLine
          label="Conversions"
          value={`${performance?.conversionCount ?? 0} total · ${
            performance?.pendingConversionCount ?? 0
          } pending`}
        />
        <DetailLine
          label="Gross attributed"
          value={formatGHS(performance?.grossMinor ?? 0)}
        />
        <DetailLine
          label="Commission"
          value={formatGHS(performance?.commissionMinor ?? 0)}
        />
        <DetailLine
          label="Approved"
          value={`${approvedConversionCount} · ${formatGHS(
            recentApprovedCommissionMinor,
          )}`}
        />
        <DetailLine
          label="Last payout"
          value={
            lastPayout
              ? `${formatGHS(lastPayout.commissionMinor)} · ${shortTime(
                  lastPayout.createdAt,
                )}`
              : "None"
          }
        />
      </Box>

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
              Recent conversions
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {performance.recentConversions.map((conversion) => {
                const actions = affiliateConversionActions(conversion.status);
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
                          {conversion.businessName || "Unknown business"}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {shortID(conversion.orderId)} ·{" "}
                          {conversion.attributionModel.replace("_", " ")}
                        </Typography>
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
                          label={conversion.status}
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
                            label="Note"
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
                              <Button
                                key={action.status}
                                type="submit"
                                name="status"
                                value={action.status}
                                size="small"
                                variant="outlined"
                              >
                                {action.label}
                              </Button>
                            ))}
                          </Stack>
                        </Stack>
                      </Form>
                    ) : null}
                  </Stack>
                );
              })}
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
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {approvedConversionCount} rows ·{" "}
                      {formatGHS(recentApprovedCommissionMinor)}
                    </Typography>
                  </Box>
                  <Button type="submit" size="small" variant="contained">
                    Reconcile payout
                  </Button>
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
                    defaultValue={affiliate.payoutReference}
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

        {performance?.recentPayouts.length ? (
          <Box
            sx={{
              p: 1.25,
              border: "1px solid",
              borderColor: alpha(tokens.success, 0.14),
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.7)",
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontWeight: 900 }}
            >
              Recent payouts
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {performance.recentPayouts.map((payout) => (
                <Stack
                  key={payout.payoutBatchId}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: "rgba(var(--surface-rgb), 0.76)",
                    justifyContent: "space-between",
                    alignItems: { sm: "center" },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }}>
                      {formatGHS(payout.commissionMinor)}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {payout.payoutReference || shortID(payout.payoutBatchId)}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Chip
                      size="small"
                      label={payout.status}
                      variant="outlined"
                    />
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {payout.conversionCount} rows ·{" "}
                      {shortTime(payout.createdAt)}
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Box>
        ) : null}

        {affiliate.notes || affiliate.payoutReference ? (
          <Box
            sx={{
              p: 1.25,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.08),
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.7)",
            }}
          >
            {affiliate.payoutReference ? (
              <Typography sx={{ overflowWrap: "anywhere" }}>
                {affiliate.payoutReference}
              </Typography>
            ) : null}
            {affiliate.notes ? (
              <Typography
                variant="body2"
                sx={{ mt: 0.5, color: "text.secondary" }}
              >
                Notes: {affiliate.notes}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        <Form method="post">
          <input type="hidden" name="intent" value="admin-affiliate:update" />
          <input
            type="hidden"
            name="affiliate_id"
            value={affiliate.affiliateId}
          />
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
                label="Entity"
                name="entity_type"
                size="small"
                defaultValue={affiliate.entityType}
                disabled={archived}
              >
                {affiliateEntityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Code"
                name="code"
                size="small"
                defaultValue={affiliate.code}
                required
                disabled={archived}
              />
              <TextField
                label="Display name"
                name="display_name"
                size="small"
                defaultValue={affiliate.displayName}
                required
                disabled={archived}
              />
              <TextField
                label="Contact name"
                name="contact_name"
                size="small"
                defaultValue={affiliate.contactName}
                disabled={archived}
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                size="small"
                defaultValue={affiliate.email}
                disabled={archived}
              />
              <TextField
                label="Phone"
                name="phone"
                size="small"
                defaultValue={affiliate.phone}
                disabled={archived}
              />
              <TextField
                label="Website"
                name="website_url"
                type="url"
                size="small"
                defaultValue={affiliate.websiteUrl}
                disabled={archived}
              />
              <TextField
                select
                label="Commission"
                name="commission_model"
                size="small"
                defaultValue={affiliate.commissionModel}
                disabled={archived}
              >
                {affiliateCommissionOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Commission value"
                name="commission_value"
                type="number"
                size="small"
                defaultValue={affiliateCommissionDefault(affiliate)}
                required
                disabled={archived}
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              />
              <TextField
                label="Cookie window"
                name="cookie_window_days"
                type="number"
                size="small"
                defaultValue={affiliate.cookieWindowDays}
                disabled={archived}
                slotProps={{
                  htmlInput: { min: 1, max: 365, step: 1 },
                }}
              />
              <TextField
                select
                label="Payout mode"
                name="payout_mode"
                size="small"
                defaultValue={affiliate.payoutMode}
                disabled={archived}
              >
                {affiliatePayoutOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                name="status"
                size="small"
                defaultValue={
                  affiliate.status === "archived" ? "paused" : affiliate.status
                }
                disabled={archived}
              >
                {affiliateStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              }}
            >
              <TextField
                label="Payout reference"
                name="payout_reference"
                size="small"
                defaultValue={affiliate.payoutReference}
                disabled={archived}
              />
              <TextField
                label="Notes"
                name="notes"
                multiline
                minRows={2}
                size="small"
                defaultValue={affiliate.notes}
                disabled={archived}
              />
            </Box>
            <Button
              type="submit"
              variant="contained"
              disabled={archived}
              sx={{ alignSelf: "flex-start" }}
            >
              Save partner
            </Button>
          </Stack>
        </Form>

        <Form method="post">
          <input type="hidden" name="intent" value="admin-affiliate:archive" />
          <input
            type="hidden"
            name="affiliate_id"
            value={affiliate.affiliateId}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Archive reason"
              name="reason"
              size="small"
              placeholder="Programme closed"
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
