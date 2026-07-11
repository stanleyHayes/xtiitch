import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../../components/form-text-field";
import { tokens } from "../../../theme";
import { affiliateConversionActions } from "../../shared/actionErrors";
import { formatGHS } from "../../shared/formatting";
import { shortID } from "../../shared/dates";
import type { AdminAffiliate, AdminAffiliateAttribution } from "../../../lib/api";

export function AffiliateConversionsPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
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
    </Stack>
  );
}
