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
import { shortTime } from "../shared/dates";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";
import { DetailLine } from "../shared/DetailLine";
import { BusinessActivityPanel } from "../businesses/BusinessActivityPanel";
import { DeleteBusinessDialog } from "../businesses/DeleteBusinessDialog";

export function BusinessInspector({ business, onReviewPayments, onOpenAudit, onClose }: { business: AdminBusiness | null; onReviewPayments: () => void; onOpenAudit: () => void; onClose: () => void; }) {
  const [view, setView] = useState<"overview" | "activity">("overview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  useEffect(() => { setView("overview"); setDeleteOpen(false); }, [business?.id]);
  if (!business) return null;
  const suspended = business.operationalStatus === "suspended";
  const accent = statusColor(business.status);
  return (
    <AdminRecordPage eyebrow="Business record" title={business.name} helper={`${business.handle}.xtiitch.com · ${business.ownerEmail}`} status={business.status} statusColor={accent} onBack={onClose}
      actions={<><Button variant="outlined" startIcon={<PaymentsRounded />} onClick={onReviewPayments}>Payments</Button><Button variant="outlined" startIcon={<HistoryRounded />} onClick={onOpenAudit}>Audit trail</Button><Button variant="contained" startIcon={<StorefrontRounded />} href={`https://${business.handle}.xtiitch.com`} target="_blank" rel="noopener noreferrer">Storefront</Button></>}>
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}><StatusChip status={business.status} /><RiskChip level={business.riskLevel} /><Chip size="small" label={business.plan} variant="outlined" /></Stack>
        <Tabs value={view} onChange={(_, next) => setView(next)} sx={{ borderBottom: "1px solid", borderColor: "divider" }}><Tab value="overview" label="Overview" /><Tab value="activity" label="Activity" /></Tabs>
        {view === "activity" ? <BusinessActivityPanel businessId={business.id} /> : (
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.15fr) minmax(300px, .85fr)" } }}>
            <Stack spacing={1.25}>
              <Typography variant="h6">Account snapshot</Typography><Divider />
              <DetailLine label="Owner" value={business.ownerEmail} />
              <DetailLine label="Subaccount" value={business.subaccountRef || "Not provisioned"} />
              <DetailLine label="Orders" value={String(business.orders)} />
              <DetailLine label="Gross volume" value={formatGHS(business.gmvMinor)} />
              <DetailLine label="Commission" value={formatGHS(business.commissionMinor)} />
              <DetailLine label="Last active" value={shortTime(business.lastActive)} />
              {business.suspensionReason ? <DetailLine label="Suspension reason" value={business.suspensionReason} /> : null}
            </Stack>
            <Stack spacing={1.25} sx={{ p: 2.25, border: "1px solid", borderColor: "divider", borderRadius: 2, alignSelf: "start" }}>
              <Typography variant="h6">Account controls</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Sensitive changes are recorded in the audit trail.</Typography>
              <Form method="post"><input type="hidden" name="intent" value="admin-business-status:update" /><input type="hidden" name="business_id" value={business.id} /><input type="hidden" name="operational_status" value={suspended ? "active" : "suspended"} />
                <Stack spacing={1.25}>{!suspended ? <TextField name="reason" label="Suspension reason" placeholder="Why should this tenant be paused?" multiline minRows={3} fullWidth /> : <input type="hidden" name="reason" value="Operator reactivated tenant activity after review." />}<Button type="submit" variant="outlined" color={suspended ? "primary" : "error"} startIcon={suspended ? <CheckCircleRounded /> : <BlockRounded />} sx={{ whiteSpace: "nowrap" }}>{suspended ? "Reactivate business" : "Suspend business"}</Button></Stack>
              </Form>
              <Divider />
              <Button variant="text" color="error" startIcon={<DeleteForeverRounded />} onClick={() => setDeleteOpen(true)} sx={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}>Delete business</Button>
            </Stack>
          </Box>
        )}
      </Stack>
      <DeleteBusinessDialog business={business} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </AdminRecordPage>
  );
}
