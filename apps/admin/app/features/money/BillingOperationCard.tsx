import { Form } from "react-router";
import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import TextField from "../../components/form-text-field";



export function BillingOperationCard({
  icon,
  title,
  helper,
  tone,
  chips,
  intent,
  noteLabel,
  noteDefault,
  actionLabel,
  actionIcon,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  tone: string;
  chips: string[];
  intent: string;
  noteLabel: string;
  noteDefault: string;
  actionLabel: string;
  actionIcon: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 1.75 },
        border: "1px solid",
        borderColor: alpha(tone, 0.18),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
        minWidth: 0,
      }}
    >
      <Stack spacing={1.4}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.15}
          sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: tone,
              bgcolor: alpha(tone, 0.1),
              border: "1px solid",
              borderColor: alpha(tone, 0.16),
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
              {chips.map((chip) => (
                <Chip
                  key={chip}
                  size="small"
                  label={chip}
                  sx={{
                    bgcolor: alpha(tone, 0.09),
                    border: "1px solid",
                    borderColor: alpha(tone, 0.18),
                    color: tone,
                    fontWeight: 900,
                  }}
                />
              ))}
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 0.35, color: "text.secondary" }}
            >
              {helper}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          <Button
            type="button"
            variant="contained"
            startIcon={actionIcon}
            onClick={() => setOpen(true)}
            sx={{
              alignSelf: { xs: "stretch", sm: "flex-start" },
              whiteSpace: "nowrap",
            }}
          >
            {actionLabel}
          </Button>
        </Stack>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="span"
                  sx={{ display: "block", fontWeight: 950 }}
                >
                  {title}
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  Confirm the operator note before running this job.
                </Typography>
              </Box>
              <IconButton aria-label="Close" onClick={() => setOpen(false)}>
                <CloseRounded />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Form method="post">
              <input type="hidden" name="intent" value={intent} />
              <Stack spacing={2}>
                <TextField
                  size="small"
                  name="reason"
                  label={noteLabel}
                  defaultValue={noteDefault}
                  fullWidth
                />
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={actionIcon}
                  >
                    {actionLabel}
                  </Button>
                </Stack>
              </Stack>
            </Form>
          </DialogContent>
        </Dialog>
      </Stack>
    </Box>
  );
}
