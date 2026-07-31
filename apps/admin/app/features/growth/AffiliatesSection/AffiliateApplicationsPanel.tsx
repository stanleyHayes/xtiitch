import { Form } from "react-router";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import HowToRegRounded from "@mui/icons-material/HowToRegRounded";
import type { AdminAffiliateApplication } from "../../../lib/api";
import TextField from "../../../components/form-text-field";
import { AdminEmptyState } from "../../../components/ui/AdminEmptyState";
import { Panel } from "../../../components/ui/Panel";
import { shortTime } from "../../shared/dates";
import { useActionSuccess } from "../../shared/useActionSuccess";

// eslint-disable-next-line max-lines-per-function -- queue, review details, and decision form are one operator workflow
export function AffiliateApplicationsPanel({
  applications,
  error,
}: {
  applications: AdminAffiliateApplication[];
  error: string | null;
}) {
  const pending = applications.filter(
    (application) => application.status === "pending_review",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    applications.find((application) => application.applicationId === selectedId) ??
    null;
  const actionSuccess = useActionSuccess("affiliates");
  useEffect(() => {
    if (actionSuccess) {
      setSelectedId(null);
    }
  }, [actionSuccess]);

  if (error) {
    return <Alert severity="warning">{error}</Alert>;
  }

  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box>
          <Typography variant="h6">Affiliate applications</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Review public applicants before their code and dashboard become active.
          </Typography>
        </Box>
        <Chip
          label={`${pending.length} pending`}
          color={pending.length > 0 ? "warning" : "default"}
          variant="outlined"
        />
      </Stack>

      {pending.length === 0 ? (
        <AdminEmptyState
          icon={<HowToRegRounded />}
          eyebrow="Application queue"
          title="No applications waiting"
          helper="New public affiliate applications will appear here for commission and audience review."
        />
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            mt: 2,
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
          }}
        >
          {pending.map((application) => (
            <Box
              key={application.applicationId}
              sx={{
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "background.paper",
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: "start" }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>
                    {application.displayName}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {application.contactName} · {application.email}
                  </Typography>
                </Box>
                <Chip label={application.requestedCode} size="small" />
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  mt: 1.5,
                  color: "text.secondary",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {application.audienceSummary}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1.5, justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Applied {shortTime(application.createdAt)}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedId(application.applicationId)}
                >
                  Review
                </Button>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Review {selected?.displayName ?? "application"}</DialogTitle>
        <Form method="post">
          <DialogContent dividers>
            <input
              type="hidden"
              name="intent"
              value="admin-affiliate-application:decide"
            />
            <input
              type="hidden"
              name="application_id"
              value={selected?.applicationId ?? ""}
            />
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>
                  Requested code: {selected?.requestedCode}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {selected?.audienceSummary}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  Channels: {selected?.promotionChannels.join(", ") || "Not supplied"}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                }}
              >
                <TextField
                  label="Purchase commission (%)"
                  name="purchase_commission_value"
                  type="number"
                  defaultValue={10}
                  required
                  slotProps={{ htmlInput: { min: 0.01, max: 100, step: 0.01 } }}
                />
                <TextField
                  label="First paid-plan commission (%)"
                  name="paid_plan_commission_value"
                  type="number"
                  defaultValue={15}
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
                />
                <TextField
                  label="Cookie window (days)"
                  name="cookie_window_days"
                  type="number"
                  defaultValue={30}
                  slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }}
                />
                <TextField
                  label="Payout mode"
                  name="payout_mode"
                  select
                  defaultValue="manual"
                >
                  <MenuItem value="manual">Manual reconciliation</MenuItem>
                  <MenuItem value="voucher">Voucher</MenuItem>
                  <MenuItem value="paystack_transfer">Paystack transfer</MenuItem>
                  <MenuItem value="paystack_split">Paystack split</MenuItem>
                </TextField>
              </Box>
              <TextField
                label="Review note"
                name="review_note"
                multiline
                minRows={3}
                placeholder="Required when rejecting; retained in the audit trail."
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedId(null)}>Cancel</Button>
            <Button
              type="submit"
              name="decision"
              value="rejected"
              color="error"
              variant="outlined"
            >
              Reject
            </Button>
            <Button
              type="submit"
              name="decision"
              value="approved"
              variant="contained"
            >
              Approve &amp; invite
            </Button>
          </DialogActions>
        </Form>
      </Dialog>
    </Panel>
  );
}
