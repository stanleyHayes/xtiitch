import { Form } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import TextField from "../../components/form-text-field";
import AiAssistField from "../../components/ai-assist";
import type { Design } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { CollectionSummary, SizeBand } from "../shared/types";
import { fallbackDesignImage } from "../shared/utils";
import { useCloseOnSuccess } from "../settings/useCloseOnSuccess";
import { ToneChip } from "../../components/ui/ToneChip";
import { CopyLinkButton } from "./CopyLinkButton";
import { DesignImagesField } from "./DesignImagesField";
import { moneyInputValue } from "../orders/utils";
import { DesignPricesSection } from "./DesignPricesSection";
import { DesignExtrasEditor } from "./DesignExtrasEditor";

export function DesignRow({
  design,
  collections,
  sizeBands,
  storeHandle,
  defaultOpen = false,
  priceError,
  imageLimit,
  isFreePlan,
}: {
  design: Design;
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  storeHandle: string;
  defaultOpen?: boolean;
  priceError?: string;
  imageLimit: number;
  isFreePlan: boolean;
}) {
  const retired = design.status === "retired";
  const image = design.images[0] || fallbackDesignImage(design);
  const collectionName =
    collections.find(
      (collection) => collection.collection_id === design.collection_id,
    )?.name ?? "No collection";
  const lowestPriceMinor = design.prices.reduce<number | null>(
    (lowest, price) =>
      lowest === null ? price.price_minor : Math.min(lowest, price.price_minor),
    null,
  );
  const priceSummary =
    lowestPriceMinor === null
      ? "No prices"
      : design.prices.length === 1
        ? formatGHS(lowestPriceMinor)
        : `From ${formatGHS(lowestPriceMinor)}`;
  const [editOpen, setEditOpen] = useState(defaultOpen);
  // Made-to-Wear vs Bespoke drives which pricing field shows (review: dynamic
  // Price/Deposit label). Controlled so the deposit field reacts immediately.
  const [customisation, setCustomisation] = useState(
    design.customisation_allowed,
  );
  // Close the edit modal once a successful update settles (review: the modal
  // used to stay open after saving).
  useCloseOnSuccess(setEditOpen, "update_design", false);
  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(var(--surface-rgb), 0.42)",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "64px minmax(0, 1fr)",
            sm: "72px minmax(0, 1fr) auto",
          },
          alignItems: "center",
          py: 1.5,
          px: { xs: 2, md: 2.5 },
          "&:hover": { bgcolor: alpha(tokens.burgundy, 0.035) },
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 58,
            height: 74,
            borderRadius: 1.5,
            overflow: "hidden",
            bgcolor: alpha(tokens.burgundy, 0.08),
            color: "primary.main",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Box
            component="img"
            src={image}
            alt=""
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: design.images[0]
                ? "none"
                : "saturate(0.9) contrast(1.04)",
            }}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap>
            {design.title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {design.description || "No description yet"}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 0.85, alignItems: "center", flexWrap: "wrap" }}
          >
            <ToneChip
              label={design.status}
              tone={retired ? tokens.mutedText : tokens.success}
            />
            <Chip size="small" variant="outlined" label={collectionName} />
            <Chip size="small" variant="outlined" label={priceSummary} />
            {design.customisation_allowed ? (
              <Chip size="small" variant="outlined" label="Customisable" />
            ) : null}
            {design.customisation_allowed &&
            (design.bespoke_display_minor ?? 0) > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={`From ${formatGHS(design.bespoke_display_minor ?? 0)}`}
              />
            ) : null}
          </Stack>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{
            gridColumn: { xs: "1 / -1", sm: "auto" },
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <CopyLinkButton
            url={`https://${storeHandle}.xtiitch.com/design/${design.handle}`}
            label="Copy design link"
          />
          <Button
            type="button"
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardRounded fontSize="small" />}
            onClick={() => setEditOpen(true)}
          >
            Edit design
          </Button>
        </Stack>
      </Box>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
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
                Edit {design.title}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Update catalogue details, media links, ordering, and visibility.
              </Typography>
            </Box>
            <IconButton aria-label="Close" onClick={() => setEditOpen(false)}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Form method="post" encType="multipart/form-data">
            <input type="hidden" name="intent" value="update_design" />
            <input type="hidden" name="design_id" value={design.design_id} />
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Design details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "minmax(0, 1fr) minmax(180px, 0.4fr)",
                    },
                  }}
                >
                  <TextField
                    name="title"
                    label="Title"
                    defaultValue={design.title}
                    size="small"
                    required
                  />
                  <TextField
                    name="collection_id"
                    label="Collection"
                    select
                    defaultValue={design.collection_id ?? ""}
                    size="small"
                  >
                    <MenuItem value="">No collection</MenuItem>
                    {collections
                      .filter((collection) => collection.status === "active")
                      .map((collection) => (
                        <MenuItem
                          key={collection.collection_id}
                          value={collection.collection_id}
                        >
                          {collection.name}
                        </MenuItem>
                      ))}
                  </TextField>
                  <AiAssistField
                    name="description"
                    label="Description"
                    assistField="design description"
                    defaultValue={design.description}
                    size="small"
                    multiline
                    minRows={2}
                    fullWidth
                    sx={{ gridColumn: { md: "1 / -1" } }}
                  />
                  <Box sx={{ gridColumn: { md: "1 / -1" } }}>
                    <DesignImagesField
                      images={design.images}
                      imageLimit={imageLimit}
                      isFreePlan={isFreePlan}
                    />
                  </Box>
                </Box>
              </Box>
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Pricing & display
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="customisation"
                      checked={customisation}
                      onChange={(event) =>
                        setCustomisation(event.target.checked)
                      }
                    />
                  }
                  label="Allow customisation (bespoke / custom orders)"
                />
                <Typography
                  variant="caption"
                  sx={{ display: "block", mb: 1.25, color: "text.secondary" }}
                >
                  {customisation
                    ? "Bespoke: the customer pays a deposit (set below). Size-band prices don't apply."
                    : "Made-to-wear: the customer pays the selected size-band price. Deposit is N/A."}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                  }}
                >
                  <TextField
                    name="sequence"
                    label="Display order"
                    type="number"
                    defaultValue={design.sequence}
                    size="small"
                    required
                    slotProps={{ htmlInput: { min: 0 } }}
                  />
                  {customisation ? (
                    <TextField
                      name="deposit_ghs"
                      label="Deposit amount"
                      defaultValue={moneyInputValue(
                        design.deposit_override_minor,
                      )}
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
                  ) : null}
                  {customisation ? (
                    <TextField
                      name="bespoke_display_ghs"
                      label="Display 'from' price"
                      helperText="Indicative price shown to shoppers (optional)"
                      defaultValue={moneyInputValue(
                        design.bespoke_display_minor ?? null,
                      )}
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
                  ) : null}
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
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveRounded />}
                >
                  Save design
                </Button>
              </Stack>
            </Stack>
          </Form>

          {!customisation ? (
            <DesignPricesSection
              design={design}
              sizeBands={sizeBands}
              error={priceError}
            />
          ) : null}

          <DesignExtrasEditor
            designId={design.design_id}
            open={editOpen}
            isFreePlan={isFreePlan}
            sizeBands={sizeBands}
          />

          <Divider sx={{ my: 2 }} />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Retire hides the piece from customers. Remove deletes it from the
              dashboard list.
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: "flex-end" }}
            >
              <Form method="post">
                <input type="hidden" name="id" value={design.design_id} />
                <input
                  type="hidden"
                  name="intent"
                  value={retired ? "restore" : "retire"}
                />
                <Button
                  type="submit"
                  size="small"
                  variant="outlined"
                  color={retired ? "primary" : "inherit"}
                >
                  {retired ? "Restore" : "Retire"}
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="id" value={design.design_id} />
                <input type="hidden" name="intent" value="delete_design" />
                <Button
                  type="submit"
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineRounded />}
                >
                  Remove
                </Button>
              </Form>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}