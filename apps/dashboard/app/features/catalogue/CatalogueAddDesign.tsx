import { Form } from "react-router";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import { Panel } from "../../components/ui/Panel";
import TextField from "../../components/form-text-field";
import AiAssistField from "../../components/ai-assist";
import { ImageDropzone } from "../shared/ImageDropzone";
import { DesignImageUploadPanel } from "../studio/DesignImageUploadPanel";
import type { CollectionSummary, Design, SizeBand } from "../shared/types";
import { styleCategories } from "./styleCategories";

// eslint-disable-next-line max-lines-per-function -- renders the complete add-design form.
export function CatalogueAddDesign({
  designs,
  collections,
  sizeBands,
  imageLimit,
  addCustomisation,
  setAddCustomisation,
  designError,
  mediaError,
}: {
  designs: Design[];
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  imageLimit: number | null;
  addCustomisation: boolean;
  setAddCustomisation: (value: boolean) => void;
  designError?: string;
  mediaError?: string;
}) {
  return (
    <Box
      sx={{
        mt: 2,
        display: "grid",
        gap: 2,
        alignItems: "start",
        gridTemplateColumns: {
          xs: "1fr",
          lg: "minmax(0, 0.55fr) minmax(0, 0.45fr)",
        },
      }}
    >
      <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", mb: 2 }}
        >
          <Box sx={{ color: "primary.main" }}>
            <ContentCutRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Add a design</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Publish a new piece to the storefront.
            </Typography>
          </Box>
        </Stack>
        <Form method="post" encType="multipart/form-data" key={designs.length}>
          <input type="hidden" name="intent" value="create" />
          {/* Empty when the plan is uncapped; the action treats that as no
              limit. Only a pre-upload courtesy check either way — the API is
              the authority and re-checks. */}
          <input type="hidden" name="image_limit" value={imageLimit ?? ""} />
          <Stack spacing={1.75}>
            {designError ? <Alert severity="error">{designError}</Alert> : null}
            <TextField name="title" label="Title" required fullWidth />
            <TextField
              name="style_category"
              label="Style category"
              select
              defaultValue=""
              helperText="Used by Explore by style and storefront filters."
              fullWidth
            >
              <MenuItem value="">Choose later</MenuItem>
              {styleCategories.map((category) => (
                <MenuItem key={category.slug} value={category.slug}>
                  {category.label} — {category.helper}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              name="collection_id"
              label="Collection"
              select
              defaultValue=""
              fullWidth
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
              fullWidth
              multiline
              minRows={3}
            />
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontWeight: 700,
                  display: "block",
                  mb: 0.5,
                }}
              >
                Design images
              </Typography>
              <ImageDropzone
                name="image_files"
                multiple
                maxFiles={imageLimit ?? undefined}
                helper={
                  imageLimit !== null
                    ? `JPG, PNG, or WebP up to 10 MB each — up to ${imageLimit} images on your plan.`
                    : "JPG, PNG, or WebP up to 10 MB each."
                }
              />
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  name="customisation"
                  checked={addCustomisation}
                  onChange={(event) =>
                    setAddCustomisation(event.target.checked)
                  }
                />
              }
              label="Allow customisation (bespoke / custom orders)"
            />
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "text.secondary",
              }}
            >
              {addCustomisation
                ? "Bespoke: the customer pays a deposit (set below); size-band prices don't apply."
                : "Made-to-wear: the customer pays the selected size-band price. Deposit is N/A."}
            </Typography>
            {!addCustomisation ? (
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Size band prices
                </Typography>
                {sizeBands.length === 0 ? (
                  <Alert severity="info">
                    Add size bands from the Size bands card before setting
                    made-to-wear prices.
                  </Alert>
                ) : (
                  <Stack spacing={1}>
                    {sizeBands.map((band) => (
                      <Stack
                        key={band.size_band_id}
                        direction={{
                          xs: "column",
                          sm: "row",
                        }}
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <Typography
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            fontWeight: 800,
                          }}
                          noWrap
                        >
                          {band.label}
                        </Typography>
                        <TextField
                          name={`price_ghs_${band.size_band_id}`}
                          label="Price"
                          size="small"
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  GHS
                                </InputAdornment>
                              ),
                            },
                            htmlInput: {
                              inputMode: "decimal",
                            },
                          }}
                          sx={{
                            width: {
                              xs: "100%",
                              sm: 180,
                            },
                          }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            ) : null}
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                },
              }}
            >
              <TextField
                name="sequence"
                label="Display order"
                type="number"
                defaultValue={designs.length + 1}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              {addCustomisation ? (
                <TextField
                  name="deposit_ghs"
                  label="Deposit amount"
                  type="number"
                  defaultValue="1"
                  required
                  helperText="Minimum GHS 1 · no maximum"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">GHS</InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: "decimal", min: 1, step: "0.01" },
                  }}
                />
              ) : null}
              {addCustomisation ? (
                <TextField
                  name="bespoke_display_ghs"
                  label="Display 'from' price"
                  helperText="Indicative price shown to shoppers (optional)"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">GHS</InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: "decimal" },
                  }}
                />
              ) : null}
            </Box>
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddRounded />}
            >
              Add design
            </Button>
          </Stack>
        </Form>
      </Panel>
      <DesignImageUploadPanel designs={designs} error={mediaError} />
    </Box>
  );
}
