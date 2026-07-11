import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import TextField from "../../../components/form-text-field";
import { StyledDateTimeField } from "../../shared/StyledDateTimeField";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { invoiceStatusLabel } from "../utils";
import type { AdminSubscription } from "../../shared/types";
import type { AdminSubscriptionInvoice } from "../../../lib/api";

export function InvoicePanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  subscription,
  openInvoice,
  latestInvoice,
  canIssueInvoice,
}: {
  subscription: AdminSubscription;
  openInvoice?: AdminSubscriptionInvoice;
  latestInvoice?: AdminSubscriptionInvoice;
  canIssueInvoice: boolean;
}) {
  return (
    <Stack spacing={1.25}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{
          justifyContent: "space-between",
          alignItems: { md: "center" },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 900 }}>Invoice control</Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary" }}
          >
            {latestInvoice
              ? `${latestInvoice.invoiceRef} · ${invoiceStatusLabel(
                  latestInvoice.status,
                )} · ${formatGHS(latestInvoice.amountMinor)}`
              : "No package invoice has been issued yet."}
          </Typography>
        </Box>
        {latestInvoice ? (
          <Chip
            size="small"
            label={`Due ${shortTime(latestInvoice.dueAt)}`}
            color={
              latestInvoice.status === "issued"
                ? "warning"
                : latestInvoice.status === "paid"
                  ? "success"
                  : "default"
            }
            variant={
              latestInvoice.status === "paid" ? "filled" : "outlined"
            }
            sx={{
              alignSelf: { xs: "flex-start", md: "center" },
            }}
          />
        ) : null}
      </Stack>

      {openInvoice ? (
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: {
              xs: "1fr",
              lg: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-subscription-invoice:paid"
            />
            <input
              type="hidden"
              name="invoice_id"
              value={openInvoice.invoiceId}
            />
            <Stack spacing={1}>
              <TextField
                size="small"
                name="reason"
                label="Paid note"
                placeholder="Paystack payment confirmed"
                fullWidth
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button
                  type="submit"
                  variant="outlined"
                  color="success"
                >
                  Mark paid
                </Button>
              </Stack>
            </Stack>
          </Form>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-subscription-invoice:failed"
            />
            <input
              type="hidden"
              name="invoice_id"
              value={openInvoice.invoiceId}
            />
            <Stack spacing={1}>
              <TextField
                size="small"
                name="reason"
                label="Failure note"
                placeholder="Card failed or link expired"
                fullWidth
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
                >
                  Mark failed
                </Button>
              </Stack>
            </Stack>
          </Form>
        </Box>
      ) : null}

      {canIssueInvoice ? (
        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value="admin-subscription-invoice:issue"
          />
          <input
            type="hidden"
            name="business_id"
            value={subscription.businessId}
          />
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            <TextField
              size="small"
              name="provider_invoice_ref"
              label="Provider ref"
              placeholder="Paystack invoice/link id"
            />
            <TextField
              size="small"
              name="payment_url"
              label="Payment link"
              placeholder="https://paystack.com/pay/..."
            />
            <StyledDateTimeField
              size="small"
              name="due_at"
              label="Due date"
            />
            <TextField
              size="small"
              name="reason"
              label="Issue note"
              placeholder="Monthly package billing"
            />
          </Box>
          <Button
            type="submit"
            variant="outlined"
            startIcon={<WorkspacePremiumRounded />}
            sx={{
              mt: 1,
              alignSelf: "flex-start",
              height: 44,
              whiteSpace: "nowrap",
            }}
          >
            Issue invoice
          </Button>
        </Form>
      ) : null}
    </Stack>
  );
}
