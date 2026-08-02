import { useRef } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import AspectRatioRounded from "@mui/icons-material/AspectRatioRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { tokens } from "../../theme";
import { useImageUploadField } from "../../lib/use-image-upload-field";
import { useFilePreviews } from "../../lib/use-file-previews";
import type { FilePreview } from "../../lib/use-file-previews";
import { MAX_UPLOAD_BUDGET_MB } from "../../lib/upload-limits";
import type { ImageSpec } from "../../lib/image-specs";

// The chosen photos, each with its own delete button. A single thumbnail over
// "4 images selected" showed neither which four had been chosen nor any way to
// drop the wrong one.
function SelectedImages({
  previews,
  multiple,
  maxFiles,
  onRemove,
}: Readonly<{
  previews: FilePreview[];
  multiple: boolean;
  maxFiles?: number;
  onRemove: (index: number) => void;
}>) {
  return (
    <Box>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        {previews.map((item, index) => (
          <Box
            key={item.url}
            sx={{
              position: "relative",
              width: 64,
              height: 64,
              borderRadius: 1.5,
              overflow: "hidden",
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.12),
            }}
          >
            <Box
              component="img"
              src={item.url}
              alt={item.file.name}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <IconButton
              size="small"
              aria-label={`Remove ${item.file.name}`}
              // The whole field is a <label>, so a click here would otherwise
              // reach the hidden file input and reopen the picker — deleting a
              // photo would look like it did nothing.
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemove(index);
              }}
              sx={{
                position: "absolute",
                top: 1,
                right: 1,
                bgcolor: "rgba(0,0,0,0.55)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.72)" },
              }}
            >
              <DeleteOutlineRounded sx={{ fontSize: 13 }} />
            </IconButton>
          </Box>
        ))}
      </Stack>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 0.75,
          color: tokens.burgundy,
          fontWeight: 700,
        }}
      >
        {multiple ? "Click or drop to add more" : "Click or drop to replace"}
        {multiple && maxFiles ? ` · up to ${maxFiles}` : ""}
      </Typography>
    </Box>
  );
}

// What the field says before anything is chosen: the target dimensions up
// front so a merchant photographing stock knows them before she shoots, not
// after the storefront has cropped the hem off.
function EmptyPrompt({
  dragging,
  multiple,
  helper,
  spec,
}: Readonly<{
  dragging: boolean;
  multiple: boolean;
  helper?: string;
  spec?: ImageSpec;
}>) {
  const prompt = dragging
    ? multiple
      ? "Drop images to upload"
      : "Drop image to upload"
    : multiple
      ? "Drag & drop, or click to choose images"
      : "Drag & drop, or click to choose";

  return (
    <Stack
      spacing={0.75}
      sx={{ alignItems: "center", textAlign: "center", py: 0.5 }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          color: tokens.burgundy,
          bgcolor: alpha(tokens.burgundy, 0.1),
        }}
      >
        <CloudUploadRounded />
      </Box>
      <Typography sx={{ fontWeight: 800 }}>{prompt}</Typography>
      {spec ? (
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            px: 0.85,
            py: 0.3,
            borderRadius: 1,
            color: tokens.burgundy,
            bgcolor: alpha(tokens.burgundy, 0.08),
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.01em",
          }}
        >
          <AspectRatioRounded sx={{ fontSize: 14 }} />
          {spec.dimensions} · {spec.ratio}
        </Box>
      ) : null}
      {helper ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {helper}
        </Typography>
      ) : null}
      {spec ? (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", maxWidth: 340 }}
        >
          {spec.note}
        </Typography>
      ) : null}
    </Stack>
  );
}

// A single-image field takes only the first of a multi-file drop; taking them
// all and keeping one would discard the rest without saying so.
function filesFromDrop(files: FileList | null, multiple: boolean): File[] {
  if (multiple) {
    return Array.from(files ?? []);
  }
  const first = files?.[0];
  return first ? [first] : [];
}

// Returns an sx colour: the palette key for the error state, a token otherwise.
function edgeColour(error: string | null, dragging: boolean): string {
  if (error) {
    return "error.main";
  }
  return dragging ? tokens.burgundy : alpha(tokens.ink, 0.22);
}

export function ImageDropzone({
  name,
  helper,
  required = false,
  disabled = false,
  multiple = false,
  maxFiles,
  spec,
}: {
  name: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  // Recommended dimensions for this surface. Shown as its own prominent line
  // rather than buried in the helper prose — a merchant photographing stock
  // needs the target size before they shoot, not after they have uploaded a
  // landscape photo the storefront crops the hem off.
  spec?: ImageSpec;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  // Photos are resized in the browser before they reach the form body: the
  // action runs on Vercel, which refuses a request over 4.5 MB before it gets
  // there. See use-image-upload-field.ts.
  const uploads = useImageUploadField(inputRef);
  const previews = useFilePreviews(uploads.files);

  const applyFiles = async (selected: FileList | File[] | null | undefined) => {
    const picked = Array.from(selected ?? []);
    // A multi-image field ADDS to what is already chosen. Picking a second time
    // used to replace the first pick wholesale, so building a set of photos
    // meant selecting them all in one go from one folder — and choosing one
    // more silently discarded the rest. A single-image field still replaces,
    // because there a second pick can only mean "use this one instead".
    await uploads.prepare(picked, { maxFiles, append: multiple });
  };

  const sizeHint = multiple
    ? `Up to ${MAX_UPLOAD_BUDGET_MB} MB per upload in total — large photos are optimised automatically.`
    : `Up to ${MAX_UPLOAD_BUDGET_MB} MB — large photos are optimised automatically.`;

  return (
    <Box
      component="label"
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) {
          return;
        }
        void applyFiles(filesFromDrop(event.dataTransfer.files, multiple));
      }}
      sx={{
        display: "block",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        borderRadius: 2,
        p: previews.length > 0 ? 1.25 : 2.5,
        border: "1.5px dashed",
        borderColor: edgeColour(uploads.error, dragging),
        bgcolor: dragging
          ? alpha(tokens.burgundy, 0.05)
          : alpha(tokens.burgundy, 0.02),
        transition: "border-color 160ms ease, background-color 160ms ease",
        "&:hover": disabled
          ? {}
          : {
              borderColor: alpha(tokens.burgundy, 0.5),
              bgcolor: alpha(tokens.burgundy, 0.04),
            },
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        multiple={multiple}
        required={required}
        disabled={disabled}
        onChange={(event) => {
          void applyFiles(event.currentTarget.files);
        }}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />
      {previews.length > 0 ? (
        <SelectedImages
          previews={previews}
          multiple={multiple}
          maxFiles={maxFiles}
          onRemove={uploads.remove}
        />
      ) : (
        <EmptyPrompt
          dragging={dragging}
          multiple={multiple}
          helper={helper}
          spec={spec}
        />
      )}
      {uploads.busy ? (
        <Skeleton
          variant="rounded"
          height={8}
          sx={{ mt: 1.25, borderRadius: 1 }}
          aria-label="Optimising images"
        />
      ) : null}
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 0.75,
          textAlign: "center",
          fontWeight: uploads.error ? 700 : 400,
          color: uploads.error ? "error.main" : "text.secondary",
        }}
      >
        {uploads.error ?? sizeHint}
      </Typography>
    </Box>
  );
}
