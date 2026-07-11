import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";



export function DialogActionsRow({
  cancelLabel,
  submitLabel,
  submitIcon,
  onCancel,
}: {
  cancelLabel: string;
  submitLabel: string;
  submitIcon?: ReactNode;
  onCancel: () => void;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ justifyContent: "flex-end" }}
    >
      <Button type="button" variant="outlined" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" variant="contained" startIcon={submitIcon}>
        {submitLabel}
      </Button>
    </Stack>
  );
}
