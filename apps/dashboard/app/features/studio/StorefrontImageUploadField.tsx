import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import {
  isPairedImageAllowed,
  MAX_PAIRED_IMAGE_MB,
  MAX_UPLOAD_BUDGET_MB,
} from "../../lib/upload-limits";

export function StorefrontImageUploadField({
  name,
  currentUrl,
}: {
  name: string;
  currentUrl: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // Oversized images are refused at pick time: the multipart form also
  // carries the second image, and Vercel rejects a combined body over 4.5 MB
  // before the action runs — which used to surface as a crash page.
  const [tooLarge, setTooLarge] = useState(false);
  return (
    <Box>
      <input type="hidden" name={`${name}_url_existing`} value={currentUrl} />
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1.5,
            flexShrink: 0,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            border: "1px dashed",
            borderColor: "divider",
            bgcolor: "rgba(var(--surface-rgb), 0.6)",
            color: "text.secondary",
          }}
        >
          {currentUrl ? (
            <Box
              component="img"
              src={currentUrl}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <CloudUploadRounded fontSize="small" />
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Button
            component="label"
            variant="outlined"
            size="small"
            startIcon={<CloudUploadRounded />}
          >
            {currentUrl ? "Replace image" : "Upload image"}
            <input
              type="file"
              name={`${name}_file`}
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && !isPairedImageAllowed(file)) {
                  // Drop the oversized pick so it never reaches the form body.
                  event.target.value = "";
                  setPicked(null);
                  setTooLarge(true);
                  return;
                }
                setTooLarge(false);
                setPicked(file?.name ?? null);
              }}
            />
          </Button>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.5,
              color: tooLarge ? "error.main" : "text.secondary",
              overflowWrap: "anywhere",
            }}
          >
            {tooLarge
              ? `That image is over ${MAX_PAIRED_IMAGE_MB} MB — export a smaller copy.`
              : picked
                ? `Selected: ${picked}`
                : `PNG or JPG up to ${MAX_PAIRED_IMAGE_MB} MB each (${MAX_UPLOAD_BUDGET_MB} MB per upload) — uploaded to Cloudinary when you save.`}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}