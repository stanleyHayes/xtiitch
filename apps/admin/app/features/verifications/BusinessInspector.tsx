import { Form } from "react-router";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../components/form-text-field";
import { AdminRecordPage } from "../../components/ui";
import { AdminBusiness } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { statusColor } from "../shared/colors";
import { shortID, shortTime, shortTimeOrFallback } from "../shared/dates";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";
import { DetailLine } from "../shared/DetailLine";
import { BusinessActivityPanel } from "../businesses/BusinessActivityPanel";
import { DeleteBusinessDialog } from "../businesses/DeleteBusinessDialog";

function labelStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function BusinessAccountSnapshot({ business }: { business: AdminBusiness }) {
  return (
    <Stack spacing={1.25}>
      <Typography variant="h6">Account snapshot</Typography>
      <Divider />
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <DetailLine label="Business ID" value={shortID(business.id)} />
        <DetailLine label="Handle" value={`${business.handle}.xtiitch.com`} />
        <DetailLine label="Owner name" value={business.ownerName} />
        <DetailLine label="Owner email" value={business.ownerEmail} />
        <DetailLine
          label="Verification"
          value={labelStatus(business.verificationStatus)}
        />
        <DetailLine
          label="Operational status"
          value={labelStatus(business.operationalStatus)}
        />
        <DetailLine label="Plan" value={business.plan} />
        <DetailLine label="Risk" value={labelStatus(business.riskLevel)} />
        <DetailLine
          label="Subaccount"
          value={business.subaccountRef || "Not provisioned"}
        />
        <DetailLine label="Orders" value={String(business.orders)} />
        <DetailLine label="Gross volume" value={formatGHS(business.gmvMinor)} />
        <DetailLine label="Commission" value={formatGHS(business.commissionMinor)} />
        <DetailLine label="Last active" value={shortTime(business.lastActive)} />
        <DetailLine
          label="Created"
          value={shortTimeOrFallback(business.createdAt)}
        />
        <DetailLine
          label="Updated"
          value={shortTimeOrFallback(business.updatedAt)}
        />
        {business.suspensionReason ? (
          <DetailLine label="Suspension reason" value={business.suspensionReason} />
        ) : null}
        {business.suspendedAt ? (
          <DetailLine
            label="Suspended at"
            value={shortTimeOrFallback(business.suspendedAt)}
          />
        ) : null}
      </Box>
    </Stack>
  );
}

function BusinessAccountControls({
  business,
  suspended,
  onDelete,
}: {
  business: AdminBusiness;
  suspended: boolean;
  onDelete: () => void;
}) {
  return (
    <Stack
      spacing={1.25}
      sx={{
        p: 2.25,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        alignSelf: "start",
      }}
    >
      <Typography variant="h6">Account controls</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Sensitive changes are recorded in the audit trail.
      </Typography>
      <Form method="post">
        <input type="hidden" name="intent" value="admin-business-status:update" />
        <input type="hidden" name="business_id" value={business.id} />
        <input
          type="hidden"
          name="operational_status"
          value={suspended ? "active" : "suspended"}
        />
        <Stack spacing={1.25}>
          {!suspended ? (
            <TextField
              name="reason"
              label="Suspension reason"
              placeholder="Why should this tenant be paused?"
              multiline
              minRows={3}
              fullWidth
            />
          ) : (
            <input
              type="hidden"
              name="reason"
              value="Operator reactivated tenant activity after review."
            />
          )}
          <Button
            type="submit"
            variant="outlined"
            color={suspended ? "primary" : "error"}
            startIcon={suspended ? <CheckCircleRounded /> : <BlockRounded />}
            sx={{ whiteSpace: "nowrap" }}
          >
            {suspended ? "Reactivate business" : "Suspend business"}
          </Button>
        </Stack>
      </Form>
      <Divider />
      <Button
        variant="text"
        color="error"
        startIcon={<DeleteForeverRounded />}
        onClick={onDelete}
        sx={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}
      >
        Delete business
      </Button>
    </Stack>
  );
}

export function BusinessInspector({
  business,
  onReviewPayments,
  onOpenAudit,
  onClose,
}: {
  business: AdminBusiness | null;
  onReviewPayments: () => void;
  onOpenAudit: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"overview" | "activity">("overview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  useEffect(() => {
    setView("overview");
    setDeleteOpen(false);
  }, [business?.id]);
  if (!business) return null;
  const suspended = business.operationalStatus === "suspended";
  const accent = statusColor(business.status);
  return (
    <AdminRecordPage
      eyebrow="Business record"
      title={business.name}
      helper={`${business.handle}.xtiitch.com · ${business.ownerEmail}`}
      status={business.status}
      statusColor={accent}
      onBack={onClose}
      actions={
        <>
          <Button variant="outlined" startIcon={<PaymentsRounded />} onClick={onReviewPayments}>
            Payments
          </Button>
          <Button variant="outlined" startIcon={<HistoryRounded />} onClick={onOpenAudit}>
            Audit trail
          </Button>
          <Button
            variant="contained"
            startIcon={<StorefrontRounded />}
            href={`https://${business.handle}.xtiitch.com`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Storefront
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <StatusChip status={business.status} />
          <RiskChip level={business.riskLevel} />
          <Chip size="small" label={business.plan} variant="outlined" />
        </Stack>
        <Tabs
          value={view}
          onChange={(_, next) => setView(next)}
          sx={{ borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab value="overview" label="Overview" />
          <Tab value="activity" label="Activity" />
        </Tabs>
        {view === "activity" ? (
          <BusinessActivityPanel key={business.id} businessId={business.id} />
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.15fr) minmax(300px, .85fr)",
              },
            }}
          >
            <BusinessAccountSnapshot business={business} />
            <BusinessAccountControls
              business={business}
              suspended={suspended}
              onDelete={() => setDeleteOpen(true)}
            />
          </Box>
        )}
      </Stack>
      <DeleteBusinessDialog
        business={business}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </AdminRecordPage>
  );
}
