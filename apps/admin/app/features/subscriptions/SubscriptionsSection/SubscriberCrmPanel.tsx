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
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import EmailRounded from "@mui/icons-material/EmailRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import SmsRounded from "@mui/icons-material/SmsRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { tokens } from "../../../theme";
import type { AdminSubscription, AdminPlan } from "../../shared/types";
import { formatGHS } from "../../shared/formatting";
import { subscriptionStatusColor } from "../../shared/colors";
import { shortTimeOrFallback } from "../../shared/dates";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import {
  billingModeLabel,
  cadenceLabel,
  subscriptionContactNumber,
  subscriptionStatusLabel,
} from "../utils";
import { ghanaPhoneDigits } from "../../shared/validation";
import { smsHref, whatsappHref } from "../../shared/communication";
import { PlanStatTile } from "../../plans/PlanStatTile";
import { ContactActionButton } from "../ContactActionButton";
import { SubscriptionFilters } from "./SubscriptionFilters";

// eslint-disable-next-line max-lines-per-function -- large presentational component; refactor in follow-up
export function SubscriberCrmPanel({
  subscriptions,
  filteredSubscriptions,
  pagedSubscriptions,
  query,
  planFilter,
  statusFilter,
  institutionFilter,
  billingModeFilter,
  cadenceFilter,
  onOpenSubscriber,
  plans,
  institutionOptions,
  page,
  pageCount,
  onQueryChange,
  onPlanFilterChange,
  onStatusFilterChange,
  onInstitutionFilterChange,
  onBillingModeFilterChange,
  onCadenceFilterChange,
  onPageChange,
}: {
  subscriptions: AdminSubscription[];
  filteredSubscriptions: AdminSubscription[];
  pagedSubscriptions: AdminSubscription[];
  query: string;
  planFilter: string;
  statusFilter: string;
  institutionFilter: string;
  billingModeFilter: string;
  cadenceFilter: string;
  // Opens the full subscriber profile (§6.2 "Click a row -> full subscriber
  // profile"). Reuses the same dialog the lifecycle list opens rather than
  // building a second detail view.
  onOpenSubscriber: (businessId: string) => void;
  plans: AdminPlan[];
  institutionOptions: string[];
  page: number;
  pageCount: number;
  onQueryChange: (value: string) => void;
  onPlanFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onInstitutionFilterChange: (value: string) => void;
  onBillingModeFilterChange: (value: string) => void;
  onCadenceFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
}) {
  const withDiscount = filteredSubscriptions.filter((subscription) =>
    subscription.discountCode.trim(),
  ).length;
  const withContact = filteredSubscriptions.filter((subscription) =>
    subscriptionContactNumber(subscription).trim(),
  ).length;

  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xs: "stretch", md: "flex-start" } }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PersonSearchRounded sx={{ color: tokens.success }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">Subscriber CRM</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Owner contact, signup, renewal, discount attribution, and
                  store links.
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Form method="post">
            <input type="hidden" name="intent" value="admin-export:download" />
            <input type="hidden" name="dataset" value="subscriptions" />
            <Button
              type="submit"
              variant="outlined"
              startIcon={<FileDownloadRounded />}
              sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
            >
              Export CSV
            </Button>
          </Form>
        </Stack>

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
            label="CRM rows"
            value={String(filteredSubscriptions.length)}
            helper={`${subscriptions.length} subscription records`}
          />
          <PlanStatTile
            label="Reachable owners"
            value={String(withContact)}
            helper="Phone or WhatsApp present"
          />
          <PlanStatTile
            label="Discount attributed"
            value={String(withDiscount)}
            helper="Latest subscription code"
          />
        </Box>

        <SubscriptionFilters
          query={query}
          planFilter={planFilter}
          statusFilter={statusFilter}
          institutionFilter={institutionFilter}
          billingModeFilter={billingModeFilter}
          cadenceFilter={cadenceFilter}
          onQueryChange={onQueryChange}
          onPlanFilterChange={onPlanFilterChange}
          onStatusFilterChange={onStatusFilterChange}
          onInstitutionFilterChange={onInstitutionFilterChange}
          onBillingModeFilterChange={onBillingModeFilterChange}
          onCadenceFilterChange={onCadenceFilterChange}
          plans={plans}
          institutionOptions={institutionOptions}
        />

        {filteredSubscriptions.length === 0 ? (
          <Alert severity="info">
            No subscribers match the selected CRM filters.
          </Alert>
        ) : (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 1120 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Business</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Cadence</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell align="right">Sales</TableCell>
                  <TableCell>Discount</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedSubscriptions.map((subscription) => (
                  <SubscriberCrmRow
                    key={subscription.businessId}
                    subscription={subscription}
                    onOpenSubscriber={onOpenSubscriber}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <PaginationFooter
          count={pageCount}
          label="subscriber CRM rows"
          page={page}
          pageSize={8}
          total={filteredSubscriptions.length}
          onChange={onPageChange}
        />
      </Stack>
    </Panel>
  );
}

// One CRM row. Extracted so the table stays within the repo's per-function limit
// rather than suppressing it.
function SubscriberCrmRow({
  subscription,
  onOpenSubscriber,
}: {
  subscription: AdminSubscription;
  onOpenSubscriber: (businessId: string) => void;
}) {
  const statusColor = subscriptionStatusColor(subscription.status);
  return (
    <TableRow
      key={subscription.businessId}
      hover
      onClick={() => onOpenSubscriber(subscription.businessId)}
      sx={{ cursor: "pointer" }}
    >
      <TableCell sx={{ minWidth: 190 }}>
        <Typography sx={{ fontWeight: 950 }}>
          {subscription.businessName}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          @{subscription.handle || "store"} ·{" "}
          {subscription.storeLink || "No store link"}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 220 }}>
        <Typography sx={{ fontWeight: 900 }}>
          {subscription.ownerName || "Owner not set"}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {subscription.ownerEmail || "No email"}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
        >
          Phone {subscription.ownerPhone || "not set"}
        </Typography>
        {/* WhatsApp is its own column in §6.2 and a genuinely
                            different number on this record: the owner's phone is
                            what SMS/OTP uses, the WhatsApp number is where order
                            chat goes. Collapsing them hid which one was missing. */}
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
        >
          WhatsApp {subscription.ownerWhatsApp || "not set"}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 170 }}>
        <Typography sx={{ fontWeight: 900 }}>
          {subscription.planName}
        </Typography>
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
          <Chip
            size="small"
            label={subscriptionStatusLabel(subscription.status)}
            sx={{
              bgcolor: alpha(statusColor, 0.1),
              color: statusColor,
              fontWeight: 850,
            }}
          />
          <Chip
            size="small"
            label={billingModeLabel(subscription.billingMode)}
            variant="outlined"
          />
        </Stack>
      </TableCell>
      <TableCell sx={{ minWidth: 110 }}>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {cadenceLabel(subscription.billingCadence)}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        <Typography variant="body2">
          Signup {shortTimeOrFallback(subscription.signupAt)}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Renewal {shortTimeOrFallback(subscription.renewalAt, "not set")}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography sx={{ fontWeight: 900 }}>
          {formatGHS(subscription.gmvMinor)}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {subscription.orders} orders · last{" "}
          {shortTimeOrFallback(subscription.lastActiveAt)}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 170 }}>
        <Typography sx={{ fontWeight: 900 }}>
          {subscription.discountCode || "None"}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {subscription.discountInstitution || "No institution"}
        </Typography>
      </TableCell>
      <SubscriberCrmActionsCell subscription={subscription} />
    </TableRow>
  );
}

// The quick-contact column (§6.2 "Quick-contact from the row (WhatsApp / SMS /
// email)"). Its own component to keep the row within the repo's per-function
// limit. stopPropagation so tapping a contact link does not also open the
// profile dialog the row click opens.
function SubscriberCrmActionsCell({
  subscription,
}: {
  subscription: AdminSubscription;
}) {
  const contactNumber = subscriptionContactNumber(subscription);
  const emailHref = subscription.ownerEmail
    ? `mailto:${subscription.ownerEmail}`
    : undefined;
  const whatsAppLink = whatsappHref(contactNumber);
  const smsLink = smsHref(contactNumber);
  return (
    <TableCell align="right" onClick={(event) => event.stopPropagation()}>
      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
        <ContactActionButton
          label="Email owner"
          href={emailHref}
          icon={<EmailRounded fontSize="small" />}
        />
        <ContactActionButton
          label="WhatsApp owner"
          href={whatsAppLink}
          icon={<WhatsAppIcon fontSize="small" />}
          external
        />
        <ContactActionButton
          label="Text owner"
          href={smsLink}
          icon={<SmsRounded fontSize="small" />}
        />
        <ContactActionButton
          label="Call owner"
          href={
            contactNumber ? `tel:${ghanaPhoneDigits(contactNumber)}` : undefined
          }
          icon={<PhoneRounded fontSize="small" />}
        />
        <ContactActionButton
          label="Open store"
          href={subscription.storeLink || undefined}
          icon={<StorefrontRounded fontSize="small" />}
          external
        />
      </Stack>
    </TableCell>
  );
}
