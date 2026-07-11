import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "../../components/form-text-field";
import { CollectionSummary } from "../shared/types";
import { useCloseOnSuccess } from "./useCloseOnSuccess";

export function CollectionEditButton({
  collection,
  error,
}: {
  collection: CollectionSummary;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(setOpen, "update_collection", Boolean(error));
  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Edit collection</DialogTitle>
        <DialogContent>
          {error ? (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {error}
            </Alert>
          ) : null}
          {open ? (
            <Form method="post">
              <input type="hidden" name="intent" value="update_collection" />
              <input
                type="hidden"
                name="collection_id"
                value={collection.collection_id}
              />
              <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                <TextField
                  name="name"
                  label="Name"
                  size="small"
                  defaultValue={collection.name}
                  required
                />
                <TextField
                  name="theme"
                  label="Theme"
                  size="small"
                  defaultValue={collection.theme}
                />
                <TextField
                  name="sequence"
                  label="Display order"
                  type="number"
                  size="small"
                  defaultValue={collection.sequence}
                  slotProps={{ htmlInput: { min: 0 } }}
                  helperText="0 keeps the current position."
                />
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="contained">
                    Save
                  </Button>
                </Stack>
              </Stack>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}