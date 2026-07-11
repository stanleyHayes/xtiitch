import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import TextField from "../../../components/form-text-field";
import { tokens } from "../../../theme";
import type { AdminSubscription } from "../../shared/types";
import type { AdminSubscriptionInvoice } from "../../../lib/api";
import { FormGroupLabel } from "../../shared/FormGroupLabel";
import {
  subscriptionBillingModeOptions,
  subscriptionStatusOptions,
} from "../utils";
import MenuItem from "@mui/material/MenuItem";
import { InvoicePanel } from "./InvoicePanel";

export function SubscriptionDetail({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  subscription,
  openInvoice,
  latestInvoice,
  canIssueInvoice,
  canCaptureAuthorization,
}: {
  subscription: AdminSubscription;
  openInvoice?: AdminSubscriptionInvoice;
  latestInvoice?: AdminSubscriptionInvoice;
  canIssueInvoice: boolean;
  canCaptureAuthorization: boolean;
}) {
  return (
    <Stack spacing={1.5}>
      <Form method="post">
        <input
          type="hidden"
          name="intent"
          value="admin-subscription:update"
        />
        <input
          type="hidden"
          name="business_id"
          value={subscription.businessId}
        />
        <Stack spacing={1.5}>
          <Box>
            <FormGroupLabel>Billing state</FormGroupLabel>
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "150px 160px minmax(220px, 1fr)",
                },
              }}
            >
              <TextField
                select
                size="small"
                label="Status"
                name="status"
                defaultValue={subscription.status}
              >
                {subscriptionStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Mode"
                name="billing_mode"
                defaultValue={subscription.billingMode}
              >
                {subscriptionBillingModeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Reason"
                name="reason"
                defaultValue=""
                placeholder="Operator note"
              />
            </Box>
          </Box>
          <Box>
            <FormGroupLabel>Provider references</FormGroupLabel>
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
                label="Paystack customer ref"
                name="provider_customer_ref"
                defaultValue={subscription.providerCustomerRef}
                placeholder="CUS_..."
              />
              <TextField
                size="small"
                label="Paystack auth/subscription ref"
                name="provider_subscription_ref"
                defaultValue={subscription.providerSubscriptionRef}
                placeholder="AUTH_... or SUB_..."
              />
            </Box>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ justifyContent: "flex-end" }}
          >
            <Button type="submit" variant="contained">
              Save billing state
            </Button>
          </Stack>
        </Stack>
      </Form>

      {canCaptureAuthorization ? (
        <Box
          component="details"
          sx={{
            mt: 1.25,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.1),
            bgcolor: "rgba(var(--surface-rgb), 0.4)",
            p: 1.25,
            "& > summary": {
              cursor: "pointer",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              "&::-webkit-details-marker": { display: "none" },
            },
            "&[open] > summary": { mb: 1.25 },
          }}
        >
          <Box component="summary">
            <Box
              component="span"
              sx={{
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: alpha(tokens.ink, 0.6),
              }}
            >
              Recurring authorization
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: 12,
                fontWeight: 800,
                color: alpha(tokens.burgundy, 0.85),
              }}
            >
              Manage
            </Box>
          </Box>
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                xl: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-subscription-authorization:init"
              />
              <input
                type="hidden"
                name="business_id"
                value={subscription.businessId}
              />
              <Stack spacing={1}>
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
                    name="callback_url"
                    label="Callback URL"
                    placeholder="https://admin.xtiitch.com/admin?section=subscriptions"
                    fullWidth
                  />
                  <TextField
                    size="small"
                    name="reason"
                    label="Link note"
                    defaultValue="Create recurring authorization link"
                    fullWidth
                  />
                </Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    type="submit"
                    variant="outlined"
                    startIcon={<CreditCardRounded />}
                  >
                    Create auth
                  </Button>
                </Stack>
              </Stack>
            </Form>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-subscription-authorization:verify"
              />
              <input
                type="hidden"
                name="business_id"
                value={subscription.businessId}
              />
              <Stack spacing={1}>
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
                    name="reference"
                    label="Paystack reference"
                    placeholder="authorization reference"
                    fullWidth
                  />
                  <TextField
                    size="small"
                    name="reason"
                    label="Verify note"
                    defaultValue="Verify recurring authorization"
                    fullWidth
                  />
                </Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    type="submit"
                    variant="outlined"
                    color="success"
                    startIcon={<CheckCircleRounded />}
                  >
                    Verify auth
                  </Button>
                </Stack>
              </Stack>
            </Form>
          </Box>
        </Box>
      ) : null}

      <Divider sx={{ my: 1.5 }} />
      <InvoicePanel
        subscription={subscription}
        openInvoice={openInvoice}
        latestInvoice={latestInvoice}
        canIssueInvoice={canIssueInvoice}
      />
    </Stack>
  );
}
