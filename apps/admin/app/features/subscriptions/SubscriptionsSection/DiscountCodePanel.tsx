import { Form } from "react-router";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import TextField from "../../../components/form-text-field";
import { tokens } from "../../../theme";
import type { AdminSubscriptionDiscountCode, AdminPlan } from "../../../lib/api";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { Panel } from "../../../components/ui/Panel";
import {
  subscriptionDiscountStatus,
  subscriptionDiscountTypeLabel,
  subscriptionDiscountValueLabel,
} from "../utils";
import { FormGroupLabel } from "../../shared/FormGroupLabel";
import { PlanStatTile } from "../../plans/PlanStatTile";
import { SubscriptionDiscountCodeFormFields } from "../SubscriptionDiscountCodeFormFields";
import { DialogHeading } from "../DialogHeading";
import { DialogActionsRow } from "../DialogActionsRow";

export function DiscountCodePanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  discountCodes,
  discountCodesError,
  plans,
  createOpen,
  selectedDiscountId,
  onCreateOpenChange,
  onSelectDiscount,
}: {
  discountCodes: AdminSubscriptionDiscountCode[];
  discountCodesError: string | null;
  plans: AdminPlan[];
  createOpen: boolean;
  selectedDiscountId: string | null;
  onCreateOpenChange: (open: boolean) => void;
  onSelectDiscount: (discountCodeId: string | null) => void;
}) {
  const activeDiscounts = discountCodes.filter(
    (discount) => subscriptionDiscountStatus(discount).label === "Active",
  );
  const appliedCount = discountCodes.reduce(
    (total, discount) => total + discount.appliedCount,
    0,
  );
  const discountMinor = discountCodes.reduce(
    (total, discount) => total + discount.discountMinor,
    0,
  );
  const selectedDiscount =
    discountCodes.find(
      (discount) => discount.discountCodeId === selectedDiscountId,
    ) ?? null;

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.burgundy, 0.16),
        backgroundImage: `
          radial-gradient(circle at 96% 0%, ${alpha(tokens.burgundy, 0.1)}, transparent 34%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xs: "stretch", md: "flex-start" } }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <LocalOfferRounded sx={{ color: tokens.burgundy }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">
                  Subscription discount codes
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  First-purchase subscription incentives, institution batches,
                  and redemption caps.
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Button
            type="button"
            variant="contained"
            startIcon={<LocalOfferRounded />}
            onClick={() => onCreateOpenChange(true)}
            sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
          >
            New code
          </Button>
        </Stack>

        {discountCodesError ? (
          <Alert severity="warning">{discountCodesError}</Alert>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          <PlanStatTile
            label="Active codes"
            value={String(activeDiscounts.length)}
            helper={`${discountCodes.length} total`}
          />
          <PlanStatTile
            label="Applied redemptions"
            value={String(appliedCount)}
            helper="Subscription discounts"
          />
          <PlanStatTile
            label="Discount value"
            value={formatGHS(discountMinor)}
            helper="Recorded applied value"
          />
        </Box>

        {!discountCodesError && discountCodes.length === 0 ? (
          <Alert severity="info">
            No subscription discount codes have been created yet.
          </Alert>
        ) : null}

        {!discountCodesError && discountCodes.length > 0 ? (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Discount</TableCell>
                  <TableCell>Eligibility</TableCell>
                  <TableCell align="right">Usage</TableCell>
                  <TableCell>Window</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {discountCodes.map((discount) => {
                  const status = subscriptionDiscountStatus(discount);
                  return (
                    <TableRow key={discount.discountCodeId} hover>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Typography sx={{ fontWeight: 950 }}>
                          {discount.code}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ mt: 0.65, flexWrap: "wrap" }}
                        >
                          <Chip
                            size="small"
                            label={status.label}
                            sx={{
                              bgcolor: alpha(status.color, 0.1),
                              color: status.color,
                              fontWeight: 900,
                            }}
                          />
                          {discount.firstPurchaseOnly ? (
                            <Chip
                              size="small"
                              label="First purchase"
                              variant="outlined"
                            />
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 900 }}>
                          {subscriptionDiscountValueLabel(discount)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          {subscriptionDiscountTypeLabel(discount.discountType)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {discount.eligiblePlans.length > 0
                            ? discount.eligiblePlans.join(", ")
                            : "All packages"}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          {discount.eligibleCadences.length > 0
                            ? discount.eligibleCadences.join(", ")
                            : "All cadences"}
                          {discount.ownerName ? ` · ${discount.ownerName}` : ""}
                          {discount.batchLabel
                            ? ` · ${discount.batchLabel}`
                            : ""}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 900 }}>
                          {discount.appliedCount}/{discount.redemptionCount}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          {typeof discount.maxRedemptionsTotal === "number"
                            ? `cap ${discount.maxRedemptionsTotal}`
                            : "uncapped"}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 170 }}>
                        <Typography variant="body2">
                          {discount.validFrom
                            ? shortTime(discount.validFrom)
                            : "Now"}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          to{" "}
                          {discount.validUntil
                            ? shortTime(discount.validUntil)
                            : "open"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          type="button"
                          variant="outlined"
                          size="small"
                          startIcon={<SettingsRounded />}
                          onClick={() =>
                            onSelectDiscount(discount.discountCodeId)
                          }
                          sx={{ whiteSpace: "nowrap" }}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}

        <Dialog
          open={createOpen}
          onClose={() => onCreateOpenChange(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <DialogHeading
              title="Create subscription code"
              helper="Issue a billing-side discount rule for subscription checkout."
              onClose={() => onCreateOpenChange(false)}
            />
          </DialogTitle>
          <DialogContent dividers>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-subscription-discount:create"
              />
              <Stack spacing={2}>
                <SubscriptionDiscountCodeFormFields plans={plans} />
                <DialogActionsRow
                  cancelLabel="Cancel"
                  submitLabel="Create code"
                  submitIcon={<LocalOfferRounded />}
                  onCancel={() => onCreateOpenChange(false)}
                />
              </Stack>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(selectedDiscount)}
          onClose={() => onSelectDiscount(null)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <DialogHeading
              title={
                selectedDiscount
                  ? `Manage ${selectedDiscount.code}`
                  : "Manage code"
              }
              helper="Update eligibility, lifecycle, and redemption controls."
              onClose={() => onSelectDiscount(null)}
            />
          </DialogTitle>
          <DialogContent dividers>
            {selectedDiscount ? (
              <Stack spacing={2.25}>
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="admin-subscription-discount:update"
                  />
                  <input
                    type="hidden"
                    name="discount_code_id"
                    value={selectedDiscount.discountCodeId}
                  />
                  <Stack spacing={2}>
                    <SubscriptionDiscountCodeFormFields
                      discountCode={selectedDiscount}
                      plans={plans}
                    />
                    <DialogActionsRow
                      cancelLabel="Cancel"
                      submitLabel="Save code"
                      onCancel={() => onSelectDiscount(null)}
                    />
                  </Stack>
                </Form>
                <Divider />
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="admin-subscription-discount:archive"
                  />
                  <input
                    type="hidden"
                    name="discount_code_id"
                    value={selectedDiscount.discountCodeId}
                  />
                  <Stack spacing={1.25}>
                    <FormGroupLabel>Archive code</FormGroupLabel>
                    <TextField
                      label="Archive reason"
                      name="reason"
                      size="small"
                      placeholder="Discount campaign ended"
                      fullWidth
                      disabled={Boolean(selectedDiscount.archivedAt)}
                    />
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ justifyContent: "flex-end" }}
                    >
                      <Button
                        type="submit"
                        variant="outlined"
                        color="warning"
                        disabled={Boolean(selectedDiscount.archivedAt)}
                      >
                        Archive code
                      </Button>
                    </Stack>
                  </Stack>
                </Form>
              </Stack>
            ) : null}
          </DialogContent>
        </Dialog>
      </Stack>
    </Panel>
  );
}
