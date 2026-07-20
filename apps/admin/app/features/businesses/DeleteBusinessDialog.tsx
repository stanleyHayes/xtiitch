import { Form } from "react-router";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import TextField from "../../components/form-text-field";
import type { AdminBusiness } from "../../lib/api";
import { useActionSuccess } from "../shared/useActionSuccess";

// §11.2: permanently deleting a tenant. The API requires the exact business
// name as `confirm=<name>` and answers 400 invalid_input on a mismatch, so the
// dialog mirrors that contract client-side: the button stays disabled until
// the typed text matches character-for-character (no accidental deletes from a
// stray click). Closes itself on a successful delete (§1.2/§11.4) — never on
// an error, so the operator sees the API's reason and can retry.
export function DeleteBusinessDialog({
  business,
  open,
  onClose,
}: {
  business: AdminBusiness | null;
  open: boolean;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const actionSuccess = useActionSuccess("businesses");

  useEffect(() => {
    if (actionSuccess) {
      setConfirmation("");
      onClose();
    }
  }, [actionSuccess, onClose]);

  // Reset the typed name whenever the dialog is (re)opened for a different
  // business, so a half-typed confirmation never carries across tenants.
  useEffect(() => {
    if (open) {
      setConfirmation("");
    }
  }, [open, business?.id]);

  const confirmed =
    business !== null && confirmation === business.name;

  return (
    <Dialog
      open={open && Boolean(business)}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <DeleteForeverRounded color="error" />
          <Typography component="span" sx={{ fontWeight: 950 }}>
            Delete business
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="error" variant="outlined">
            This is permanent. Deleting removes the store and all its data —
            the storefront, designs, orders, and payout records. This cannot be
            undone.
          </Alert>
          <Typography sx={{ color: "text.secondary" }}>
            Type the exact business name{" "}
            <Typography component="strong" sx={{ fontWeight: 900 }}>
              {business?.name}
            </Typography>{" "}
            to confirm deletion.
          </Typography>
          <Form method="post" id="delete-business-form">
            <input
              type="hidden"
              name="intent"
              value="admin-business:delete"
            />
            <input
              type="hidden"
              name="business_id"
              value={business?.id ?? ""}
            />
            <TextField
              name="confirm_name"
              label="Business name"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={business?.name ?? ""}
              autoComplete="off"
              fullWidth
              required
            />
          </Form>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="button" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="delete-business-form"
          variant="contained"
          color="error"
          startIcon={<DeleteForeverRounded />}
          disabled={!confirmed}
        >
          Delete permanently
        </Button>
      </DialogActions>
    </Dialog>
  );
}
