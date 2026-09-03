import { useState } from "react";
import { Form } from "react-router";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PersonOffRounded from "@mui/icons-material/PersonOffRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import TextField from "../../../components/form-text-field";
import type { AdminAffiliate } from "../../../lib/api";
import { affiliateCommissionDefault } from "../utils";

type LifecycleAction = "activate" | "block" | "reactivate" | "archive";

const actionCopy: Record<LifecycleAction, { title: string; helper: string }> = {
  activate: { title: "Activate Affiliate", helper: "Enable attribution and Affiliate access." },
  block: { title: "Block Affiliate", helper: "Pause attribution and payouts while preserving history." },
  reactivate: { title: "Reactivate Affiliate", helper: "Restore an Affiliate that was previously blocked." },
  archive: { title: "Deactivate Affiliate", helper: "Terminate access while retaining referral and financial history." },
};

// eslint-disable-next-line complexity -- status-specific icon and confirmation states share one compact lifecycle workflow
export function AffiliateLifecycleActions({ affiliate }: { affiliate: AdminAffiliate }) {
  const [action, setAction] = useState<LifecycleAction | null>(null);
  if (affiliate.status === "archived") return null;
  const targetStatus = action === "block" ? "paused" : "active";
  const archive = action === "archive";

  return (
    <Box sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ fontWeight: 900 }}>Affiliate actions</Typography>
        <Stack direction="row" spacing={0.5}>
          {affiliate.status === "pending_review" ? <ActionIcon label="Activate" onClick={() => setAction("activate")}><CheckCircleRounded /></ActionIcon> : null}
          {affiliate.status === "active" ? <ActionIcon label="Block" onClick={() => setAction("block")} color="warning"><BlockRounded /></ActionIcon> : null}
          {affiliate.status === "paused" ? <ActionIcon label="Reactivate" onClick={() => setAction("reactivate")} color="success"><RestartAltRounded /></ActionIcon> : null}
          <ActionIcon label="Deactivate" onClick={() => setAction("archive")} color="error"><PersonOffRounded /></ActionIcon>
        </Stack>
      </Stack>
      <Dialog open={Boolean(action)} onClose={() => setAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>{action ? actionCopy[action].title : "Affiliate action"}</DialogTitle>
        <Form method="post">
          <DialogContent dividers>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{action ? actionCopy[action].helper : ""}</Typography>
            <input type="hidden" name="intent" value={archive ? "admin-affiliate:archive" : "admin-affiliate:update"} />
            <input type="hidden" name="affiliate_id" value={affiliate.affiliateId} />
            {!archive ? <>
              <input type="hidden" name="entity_type" value={affiliate.entityType} />
              <input type="hidden" name="code" value={affiliate.code} />
              <input type="hidden" name="display_name" value={affiliate.displayName} />
              <input type="hidden" name="contact_name" value={affiliate.contactName} />
              <input type="hidden" name="email" value={affiliate.email} />
              <input type="hidden" name="phone" value={affiliate.phone} />
              <input type="hidden" name="region" value={affiliate.region} />
              <input type="hidden" name="website_url" value={affiliate.websiteUrl} />
              <input type="hidden" name="commission_model" value={affiliate.commissionModel} />
              <input type="hidden" name="commission_value" value={affiliateCommissionDefault(affiliate)} />
              <input type="hidden" name="purchase_commission_value" value={affiliate.purchaseCommissionBps / 100} />
              <input type="hidden" name="paid_plan_commission_value" value={affiliate.firstPaidPlanCommissionBps / 100} />
              <input type="hidden" name="cookie_window_days" value={affiliate.cookieWindowDays} />
              <input type="hidden" name="payout_mode" value={affiliate.payoutMode} />
              <input type="hidden" name="payout_reference" value={affiliate.payoutReference} />
              <input type="hidden" name="status" value={targetStatus} />
              <input type="hidden" name="notes" value={affiliate.notes} />
            </> : null}
            <TextField required autoFocus fullWidth name="reason" label="Reason" multiline minRows={2} helperText="Required and retained in the audit trail." />
          </DialogContent>
          <DialogActions>
            <Tooltip title="Cancel"><IconButton type="button" aria-label="Cancel" onClick={() => setAction(null)}><CloseRounded /></IconButton></Tooltip>
            <Tooltip title={action ? actionCopy[action].title : "Confirm"}>
              <IconButton type="submit" aria-label={action ? actionCopy[action].title : "Confirm"} color={archive ? "error" : "primary"}>
                {action === "block" ? <BlockRounded /> : action === "archive" ? <PersonOffRounded /> : action === "reactivate" ? <RestartAltRounded /> : <CheckCircleRounded />}
              </IconButton>
            </Tooltip>
          </DialogActions>
        </Form>
      </Dialog>
    </Box>
  );
}

function ActionIcon({ label, onClick, color = "primary", children }: { label: string; onClick: () => void; color?: "primary" | "warning" | "success" | "error"; children: React.ReactNode }) {
  return <Tooltip title={label}><IconButton type="button" aria-label={label} color={color} onClick={onClick}>{children}</IconButton></Tooltip>;
}
