import { Link as RouterLink } from "react-router";
import { useFetcher } from "react-router";
import { useEffect } from "react";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import TextField from "../../components/form-text-field";
import { SizeBand, DesignExtrasData } from "../shared/types";
import { DesignImagesField } from "./DesignImagesField";
import { VariationRow } from "./VariationRow";
import { SizeBandOverrideForm } from "./SizeBandOverrideForm";

export function DesignExtrasEditor({
  designId,
  open,
  isFreePlan,
  sizeBands,
}: {
  designId: string;
  open: boolean;
  isFreePlan: boolean;
  sizeBands: SizeBand[];
}) {
  const url = `/design-editor/${encodeURIComponent(designId)}`;
  const data = useFetcher<DesignExtrasData>();
  const write = useFetcher<DesignExtrasData>();
  const [addVariationOpen, setAddVariationOpen] = useState(false);
  // Free plan caps images per variation at 2; paid plans at 5.
  const perVariationImageLimit = isFreePlan ? 2 : 5;

  // Load the current variations/overrides once the editor is opened. `data.data`
  // becomes defined after the load settles, so this fires exactly once per open.
  useEffect(() => {
    if (open && data.state === "idle" && data.data === undefined) {
      data.load(url);
    }
  }, [open, url, data]);

  // A successful write returns the freshest state; fall back to the load.
  const source = write.data?.ok ? write.data : data.data;
  const variations = [...(source?.variations ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const overrides = source?.overrides ?? [];
  const overrideByBand = new Map(
    overrides.map((override) => [override.size_band_id, override]),
  );
  const limitReached = write.data?.error === "variation_limit_reached";

  // Close the add-variation form after a successful create.
  const writeState = write.state;
  const writeOk = write.data?.ok;
  const writeOp = write.formData?.get("op");
  useEffect(() => {
    if (writeState === "idle" && writeOk && writeOp === "create_variation") {
      setAddVariationOpen(false);
    }
  }, [writeState, writeOk, writeOp]);

  const reorder = (index: number, direction: -1 | 1) => {
    const ids = variations.map((variation) => variation.variation_id);
    const target = index + direction;
    const current = ids[index];
    const swap = ids[target];
    if (current === undefined || swap === undefined) {
      return;
    }
    ids[index] = swap;
    ids[target] = current;
    const body = new FormData();
    body.set("op", "reorder_variations");
    body.set("ordered_ids", ids.join(","));
    write.submit(body, { method: "post", action: url });
  };

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
        >
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Colour variations</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              The design&apos;s own images are variation 1. Add more colourways,
              each with its own images.
            </Typography>
          </Box>
          <Button
            type="button"
            size="small"
            variant="outlined"
            startIcon={<AddRounded />}
            onClick={() => setAddVariationOpen((current) => !current)}
          >
            Add variation
          </Button>
        </Stack>

        {limitReached ? (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            You&apos;ve reached the colour-variation limit on your plan.{" "}
            <MuiLink component={RouterLink} to="/onboarding/billing">
              Upgrade
            </MuiLink>{" "}
            to add more colourways.
          </Alert>
        ) : null}
        {write.data?.error === "image_limit_exceeded" ? (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            That variation has too many images for your plan (max{" "}
            {perVariationImageLimit}).
          </Alert>
        ) : null}

        {addVariationOpen ? (
          <write.Form
            method="post"
            action={url}
            encType="multipart/form-data"
            style={{ marginBottom: 12 }}
          >
            <input type="hidden" name="op" value="create_variation" />
            <Stack
              spacing={1.25}
              sx={{
                p: 1.5,
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <TextField
                name="name"
                label="Colour / variation name"
                size="small"
                required
              />
              <DesignImagesField
                images={[]}
                imageLimit={perVariationImageLimit}
                isFreePlan={isFreePlan}
              />
              <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => setAddVariationOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="contained" size="small">
                  Add variation
                </Button>
              </Stack>
            </Stack>
          </write.Form>
        ) : null}

        {data.state === "loading" && source === undefined ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Loading variations…
          </Typography>
        ) : variations.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No extra colour variations yet.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {variations.map((variation, index) => (
              <VariationRow
                key={variation.variation_id}
                variation={variation}
                index={index}
                total={variations.length}
                actionUrl={url}
                write={write}
                imageLimit={perVariationImageLimit}
                isFreePlan={isFreePlan}
                onReorder={reorder}
              />
            ))}
          </Stack>
        )}
      </Box>

      {sizeBands.length > 0 ? (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography sx={{ fontWeight: 900, mb: 0.5 }}>
              Size-band overrides
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mb: 1.5 }}
            >
              Rename a band or tweak its measurement chart for this design only.
              Leave a field blank to inherit the master band.
            </Typography>
            <Stack spacing={1.25}>
              {sizeBands.map((band) => (
                <SizeBandOverrideForm
                  key={band.size_band_id}
                  band={band}
                  override={overrideByBand.get(band.size_band_id)}
                  actionUrl={url}
                  write={write}
                />
              ))}
            </Stack>
          </Box>
        </>
      ) : null}
    </>
  );
}