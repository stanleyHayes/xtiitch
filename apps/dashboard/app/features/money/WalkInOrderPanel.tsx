import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AddRounded from "@mui/icons-material/AddRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import TextField from "../../components/form-text-field";
import type { Design } from "../../lib/api";
import { tokens } from "../../theme";
import { SizeBand, MeasurementField } from "../shared/types";
import { useCloseOnSuccess } from "../settings/useCloseOnSuccess";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";

export function WalkInOrderPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  designs,
  sizeBands,
  measurementFields,
  error,
}: {
  designs: Design[];
  sizeBands: SizeBand[];
  measurementFields: MeasurementField[];
  error?: string;
}) {
  const activeDesigns = designs.filter((design) => design.status === "active");
  const [createOpen, setCreateOpen] = useState(false);
  useCloseOnSuccess(
    setCreateOpen,
    ["create_walk_in_order", "create_custom_walk_in_order"],
    Boolean(error),
  );
  // Ready-made (priced against a size band) vs bespoke (measured, priced later).
  const [orderType, setOrderType] = useState<"ready_made" | "bespoke">(
    "ready_made",
  );
  const bespoke = orderType === "bespoke";
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.success, 0.07)}, transparent 50%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.72))`,
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "stretch", lg: "flex-start" },
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <AddRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Log a walk-in</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Create an in-studio order for a customer who calls or walks in.
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          <ToneChip
            label={`${activeDesigns.length} active designs`}
            tone={activeDesigns.length > 0 ? tokens.success : tokens.warning}
          />
          <Button
            type="button"
            variant="contained"
            startIcon={<AddRounded />}
            disabled={activeDesigns.length === 0}
            onClick={() => setCreateOpen(true)}
          >
            New walk-in
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
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
                Create walk-in order
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Capture the design, value, and customer details in one focused
                flow.
              </Typography>
            </Box>
            <IconButton aria-label="Close" onClick={() => setCreateOpen(false)}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value={
                bespoke ? "create_custom_walk_in_order" : "create_walk_in_order"
              }
            />
            <Stack spacing={2}>
              <TextField
                select
                label="Order type"
                size="small"
                value={orderType}
                onChange={(event) =>
                  setOrderType(event.target.value as "ready_made" | "bespoke")
                }
                sx={{ maxWidth: { sm: 240 } }}
              >
                <MenuItem value="ready_made">Ready-made (priced now)</MenuItem>
                <MenuItem value="bespoke">
                  Bespoke (measured, priced later)
                </MenuItem>
              </TextField>
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Order details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  <TextField
                    name="design_id"
                    label="Design"
                    select
                    size="small"
                    defaultValue={activeDesigns[0]?.design_id ?? ""}
                    disabled={activeDesigns.length === 0}
                    required
                  >
                    {activeDesigns.length === 0 ? (
                      <MenuItem value="">Add an active design first</MenuItem>
                    ) : null}
                    {activeDesigns.map((design) => (
                      <MenuItem key={design.design_id} value={design.design_id}>
                        {design.title}
                      </MenuItem>
                    ))}
                  </TextField>
                  {!bespoke ? (
                    <>
                      <TextField
                        name="size_band_id"
                        label="Size"
                        select
                        size="small"
                        defaultValue=""
                      >
                        <MenuItem value="">No size yet</MenuItem>
                        {sizeBands.map((band) => (
                          <MenuItem
                            key={band.size_band_id}
                            value={band.size_band_id}
                          >
                            {band.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        name="agreed_total_ghs"
                        label="Agreed total"
                        size="small"
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                GHS
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { inputMode: "decimal" },
                        }}
                      />
                    </>
                  ) : null}
                </Box>
                {bespoke ? (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", mt: 0.5, display: "block" }}
                  >
                    Bespoke pricing is agreed later — set the total once the
                    work is scoped.
                  </Typography>
                ) : null}
              </Box>
              {bespoke ? (
                <Box>
                  <Typography sx={{ mb: 1, fontWeight: 900 }}>
                    Measurements{" "}
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: "text.secondary", fontWeight: 400 }}
                    >
                      (optional)
                    </Typography>
                  </Typography>
                  {measurementFields.length === 0 ? (
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Add measurement fields under Measurements to capture them
                      here.
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          md: "repeat(3, minmax(0, 1fr))",
                        },
                      }}
                    >
                      {measurementFields.map((field) => (
                        <TextField
                          key={field.field_id}
                          name={`m_${field.field_id}`}
                          label={`${field.label} (${field.unit})`}
                          size="small"
                          slotProps={{ htmlInput: { inputMode: "decimal" } }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              ) : null}
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Customer details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  <TextField
                    name="customer_name"
                    label="Customer name"
                    size="small"
                    required
                  />
                  <TextField name="customer_phone" label="Phone" size="small" />
                  <TextField
                    name="customer_email"
                    label="Email"
                    type="email"
                    size="small"
                  />
                </Box>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddRounded />}
                  disabled={activeDesigns.length === 0}
                >
                  Create order
                </Button>
              </Stack>
            </Stack>
          </Form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
