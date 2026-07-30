import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import { tokens } from "../../theme";
import { useImageUploadField } from "../../lib/use-image-upload-field";
import { MAX_UPLOAD_BUDGET_MB } from "../../lib/upload-limits";

export function ImageDropzone({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  name,
  helper,
  required = false,
  disabled = false,
  multiple = false,
  maxFiles,
}: {
  name: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  maxFiles?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Photos are resized in the browser before they reach the form body: the
  // action runs on Vercel, which refuses a request over 4.5 MB before it gets
  // there. See use-image-upload-field.ts.
  const uploads = useImageUploadField(inputRef);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const showPreview = (files: File[]) => {
    const first = files[0] ?? null;
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return first ? URL.createObjectURL(first) : null;
    });
    setFileNames(files.map((file) => file.name));
  };

  const applyFiles = async (selected: FileList | File[] | null | undefined) => {
    const picked = Array.from(selected ?? []);
    // Preview the raw pick immediately so the field reacts to the tap, then
    // swap in whatever survives resizing and the size budget.
    showPreview(picked.filter((file) => file.type.startsWith("image/")));
    showPreview(await uploads.prepare(picked, maxFiles));
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
        const dropped = multiple
          ? Array.from(event.dataTransfer.files ?? [])
          : [event.dataTransfer.files?.[0]].filter((file): file is File =>
              Boolean(file),
            );
        void applyFiles(dropped);
      }}
      sx={{
        display: "block",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        borderRadius: 2,
        p: previewUrl ? 1.25 : 2.5,
        border: "1.5px dashed",
        borderColor: uploads.error
          ? "error.main"
          : dragging
            ? tokens.burgundy
            : alpha(tokens.ink, 0.22),
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
      {previewUrl ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            component="img"
            src={previewUrl}
            alt=""
            sx={{
              width: 64,
              height: 64,
              borderRadius: 1.5,
              objectFit: "cover",
              flexShrink: 0,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.12),
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }} noWrap>
              {fileNames.length === 1
                ? fileNames[0]
                : `${fileNames.length} images selected`}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: tokens.burgundy, fontWeight: 700 }}
            >
              Click or drop to replace
              {multiple && maxFiles ? ` · up to ${maxFiles}` : ""}
            </Typography>
          </Box>
        </Stack>
      ) : (
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
          <Typography sx={{ fontWeight: 800 }}>
            {dragging
              ? multiple
                ? "Drop images to upload"
                : "Drop image to upload"
              : multiple
                ? "Drag & drop, or click to choose images"
                : "Drag & drop, or click to choose"}
          </Typography>
          {helper ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {helper}
            </Typography>
          ) : null}
        </Stack>
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
