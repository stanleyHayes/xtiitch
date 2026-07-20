import { Form } from "react-router";
import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { AdminCustomer } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortID, shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { DetailLine } from "../shared/DetailLine";
import { useActionSuccess } from "../shared/useActionSuccess";



export function CustomerInspector({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  customer,
  onClose,
}: {
  customer: AdminCustomer | null;
  onClose: () => void;
}) {
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState("");

  // §1.2/§11.4: close the erase dialog only after the erase actually
  // succeeds — an error keeps it open with the typed confirmation intact.
  // The confirmation field is controlled, so clear it here too.
  const actionSuccess = useActionSuccess("customers");
  useEffect(() => {
    if (actionSuccess) {
      setEraseOpen(false);
      setEraseConfirm("");
    }
  }, [actionSuccess]);
  if (!customer) {
    return (
      <Panel sx={{ p: 3, position: { xl: "sticky" }, top: 88 }}>
        <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
          <Avatar
            sx={{
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <PeopleAltRounded />
          </Avatar>
          <Typography variant="h6">Select a customer</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Inspect contact, order volume, linked businesses, and customer GMV.
          </Typography>
        </Stack>
      </Panel>
    );
  }

  const contact = customer.email || customer.phone || "No contact on file";
  const lastBusiness = customer.lastBusinessName
    ? `${customer.lastBusinessName} · ${customer.lastBusinessHandle}`
    : "No linked business activity";

  return (
    <Panel sx={{ p: 2.5, position: { xl: "sticky" }, top: 88 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
          <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: tokens.burgundy }}>
              <PeopleAltRounded />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                {customer.displayName || contact}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
              >
                {shortID(customer.id)}
              </Typography>
            </Box>
          </Stack>
          <IconButton aria-label="Close customer inspector" onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
        <Divider />
        <DetailLine label="Contact" value={contact} />
        <DetailLine label="Phone" value={customer.phone || "Not provided"} />
        <DetailLine
          label="Linked businesses"
          value={String(customer.tenantCount)}
        />
        <DetailLine label="Orders" value={String(customer.orderCount)} />
        <DetailLine
          label="Custom orders"
          value={String(customer.customOrderCount)}
        />
        <DetailLine label="Customer GMV" value={formatGHS(customer.gmvMinor)} />
        <DetailLine label="Last business" value={lastBusiness} />
        <DetailLine
          label="Last active"
          value={shortTime(customer.lastActive)}
        />
        <DetailLine label="Created" value={shortTime(customer.createdAt)} />
        <DetailLine label="Updated" value={shortTime(customer.updatedAt)} />
        <Divider />
        <Button
          component="a"
          href={`/admin/customers/${customer.id}/export`}
          download
          variant="outlined"
          size="small"
          startIcon={<FileDownloadRounded />}
        >
          Export data (Act 843)
        </Button>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Downloads everything the platform holds about this customer — profile,
          linked businesses, orders and measurements — as a JSON file, for a
          Data Protection Act subject-access request.
        </Typography>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => {
            setEraseConfirm("");
            setEraseOpen(true);
          }}
        >
          Erase data (right to be forgotten)
        </Button>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Anonymises this customer&apos;s personal data across every business.
          Orders are kept for accounting but no longer carry personal data. This
          cannot be undone.
        </Typography>
      </Stack>
      <Dialog
        open={eraseOpen}
        onClose={() => setEraseOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: "error.main", fontWeight: 800 }}>
          Erase customer data?
        </DialogTitle>
        <Form method="post">
          <DialogContent>
            <input type="hidden" name="intent" value="admin-customer:erase" />
            <input type="hidden" name="customer_id" value={customer.id} />
            <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
              This permanently anonymises{" "}
              <strong>{customer.displayName || contact}</strong> across all
              businesses for a Data Protection Act (Act 843) erasure request.
              Type <strong>ERASE CUSTOMER DATA</strong> to confirm.
            </Typography>
            <TextField
              name="confirmation"
              value={eraseConfirm}
              onChange={(event) => setEraseConfirm(event.target.value)}
              fullWidth
              size="small"
              autoFocus
              placeholder="ERASE CUSTOMER DATA"
            />
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 2.5, justifyContent: "flex-end" }}
            >
              <Button type="button" onClick={() => setEraseOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                color="error"
                variant="contained"
                disabled={eraseConfirm.trim() !== "ERASE CUSTOMER DATA"}
              >
                Erase data
              </Button>
            </Stack>
          </DialogContent>
        </Form>
      </Dialog>
    </Panel>
  );
}
