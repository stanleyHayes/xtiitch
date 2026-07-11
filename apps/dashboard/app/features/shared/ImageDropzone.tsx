import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import { tokens } from "../../theme";

export function ImageDropzone({
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

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const applyFiles = (selected: FileList | File[] | null | undefined) => {
    const files = Array.from(selected ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, maxFiles ?? undefined);
    const first = files[0] ?? null;
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return first ? URL.createObjectURL(first) : null;
    });
    setFileNames(files.map((file) => file.name));
  };
  const capInputFiles = (input: HTMLInputElement) => {
    if (
      !multiple ||
      !maxFiles ||
      !input.files ||
      input.files.length <= maxFiles
    ) {
      return;
    }
    const transfer = new DataTransfer();
    Array.from(input.files)
      .slice(0, maxFiles)
      .forEach((file) => {
        transfer.items.add(file);
      });
    input.files = transfer.files;
  };

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
        if (dropped.length > 0 && inputRef.current) {
          const transfer = new DataTransfer();
          dropped.slice(0, maxFiles ?? undefined).forEach((file) => {
            transfer.items.add(file);
          });
          inputRef.current.files = transfer.files;
        }
        applyFiles(dropped);
      }}
      sx={{
        display: "block",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        borderRadius: 2,
        p: previewUrl ? 1.25 : 2.5,
        border: "1.5px dashed",
        borderColor: dragging ? tokens.burgundy : alpha(tokens.ink, 0.22),
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
          capInputFiles(event.currentTarget);
          applyFiles(event.currentTarget.files);
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
    </Box>
  );
}