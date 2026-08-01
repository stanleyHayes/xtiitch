import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import PaletteRounded from "@mui/icons-material/PaletteRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { DesignImagesField } from "../studio/DesignImagesField";

// Colour variations, collected while the design is being created.
//
// Before this, a variation could only be added by saving the design, finding it
// in the catalogue and opening the editor — three navigations to finish one
// thought, which on a slow connection is three page loads. The API creates a
// variation against an existing design (POST /designs/{id}/variations), so the
// action still creates the design first and then each variation; what changes
// is that the owner supplies it all in one pass.
//
// Fields are named variation_name_N / variation_images_N. The action walks N
// upward until a name is missing, so removing a row mid-list cannot silently
// drop the rows after it.
export function NewDesignVariations({
  variationLimit,
  imageLimit,
  isFreePlan,
}: Readonly<{
  // null means the plan does not cap variations.
  variationLimit: number | null;
  imageLimit: number | null;
  isFreePlan: boolean;
}>) {
  const [rows, setRows] = useState<number[]>([]);
  const [nextKey, setNextKey] = useState(0);

  // The design's own images are variation 1, matching the editor's wording, so
  // the cap counts them.
  const used = rows.length + 1;
  const full = variationLimit !== null && used >= variationLimit;

  const add = () => {
    setRows((current) => [...current, nextKey]);
    setNextKey((key) => key + 1);
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <PaletteRounded sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
            Colour variations
          </Typography>
        </Stack>
        {variationLimit !== null ? (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {used} of {variationLimit} on your plan
          </Typography>
        ) : null}
      </Stack>
      <Typography
        variant="caption"
        sx={{ display: "block", mb: 1.25, color: "text.secondary" }}
      >
        Optional. The images above are variation 1 — add more colourways here,
        each with its own photos, and they save together with the design.
      </Typography>

      {rows.map((key, index) => (
        <Box
          key={key}
          sx={{
            p: 1.5,
            mb: 1,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: alpha(tokens.ink, 0.015),
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "flex-start", mb: 1 }}
          >
            <TextField
              name={`variation_name_${index}`}
              label="Colour / variation name"
              placeholder="e.g. Black"
              required
              size="small"
              fullWidth
            />
            <IconButton
              aria-label="Remove variation"
              onClick={() => setRows((c) => c.filter((k) => k !== key))}
              sx={{ mt: 0.5 }}
            >
              <DeleteOutlineRounded fontSize="small" />
            </IconButton>
          </Stack>
          {/* Reuses the editor's image field, so a variation's photos get the
              same resizing, previews and plan-cap handling as everything else.
              Its share of the upload budget is allocated by the provider that
              wraps the whole form. */}
          <DesignImagesField
            name={`variation_images_${index}`}
            images={[]}
            imageLimit={imageLimit}
            isFreePlan={isFreePlan}
          />
        </Box>
      ))}

      <Button
        type="button"
        variant="outlined"
        size="small"
        startIcon={<AddRounded />}
        onClick={add}
        disabled={full}
      >
        Add variation
      </Button>
      {full ? (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          That is every variation your plan allows, counting the design itself.
        </Typography>
      ) : null}
    </Box>
  );
}
