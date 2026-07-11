import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { SizeBand } from "../shared/types";
import { useCloseOnSuccess } from "./useCloseOnSuccess";
import { SizeBandForm } from "./SizeBandForm";

export function SizeBandEditButton({
  band,
  error,
}: {
  band: SizeBand;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(setOpen, "update_size_band", Boolean(error));
  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit size band &amp; chart</DialogTitle>
        <DialogContent>
          {error ? (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {error}
            </Alert>
          ) : null}
          {open ? (
            <SizeBandForm band={band} onCancel={() => setOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}