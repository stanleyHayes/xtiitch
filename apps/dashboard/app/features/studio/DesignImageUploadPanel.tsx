import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import TextField from "../../components/form-text-field";
import type { Design } from "../../lib/api";
import { tokens } from "../../theme";
import { Panel } from "../../components/ui/Panel";
import { ImageDropzone } from "../shared/ImageDropzone";

export function DesignImageUploadPanel({
  designs,
  error,
}: {
  designs: Design[];
  error?: string;
}) {
  const uploadableDesigns = designs.filter(
    (design) => design.status !== "deleted",
  );

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.info, 0.07)}, transparent 50%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.74))`,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ color: "primary.main" }}>
          <CloudUploadRounded />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>Upload design image</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Attach a photo to an existing catalogue piece.
          </Typography>
        </Box>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      ) : null}

      <Form method="post" encType="multipart/form-data">
        <input type="hidden" name="intent" value="upload_design_image" />
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          <TextField
            name="design_id"
            label="Design"
            select
            defaultValue={uploadableDesigns[0]?.design_id ?? ""}
            disabled={uploadableDesigns.length === 0}
            required
            size="small"
          >
            {uploadableDesigns.length === 0 ? (
              <MenuItem value="">Add a design first</MenuItem>
            ) : null}
            {uploadableDesigns.map((design) => (
              <MenuItem key={design.design_id} value={design.design_id}>
                {design.title}
              </MenuItem>
            ))}
          </TextField>
          <ImageDropzone
            name="image_file"
            required
            disabled={uploadableDesigns.length === 0}
            helper="JPG, PNG, or WebP up to 10 MB. Becomes the first catalogue image."
          />
          <Button
            type="submit"
            variant="outlined"
            startIcon={<CloudUploadRounded />}
            disabled={uploadableDesigns.length === 0}
          >
            Upload and attach
          </Button>
        </Stack>
      </Form>
    </Panel>
  );
}