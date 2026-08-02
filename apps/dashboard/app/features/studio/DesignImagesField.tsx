import { Link as RouterLink } from "react-router";
import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { useImageUploadField } from "../../lib/use-image-upload-field";
import { useFilePreviews } from "../../lib/use-file-previews";
import { MAX_UPLOAD_BUDGET_MB } from "../../lib/upload-limits";
import { DESIGN_IMAGE_SPEC, specSummary } from "../../lib/image-specs";

// The line under the "Add images" button: a skeleton while photos are being
// resized, then either what went wrong or the size ceiling. The ceiling is
// stated up front rather than only on failure, so nobody has to discover it by
// hitting it.
function UploadStatus({
  busy,
  error,
  pendingCount,
}: Readonly<{ busy: boolean; error: string | null; pendingCount: number }>) {
  return (
    <>
      {busy ? (
        <Skeleton
          variant="text"
          width={180}
          sx={{ mt: 0.5, fontSize: "0.75rem" }}
          aria-label="Optimising images"
        />
      ) : null}
      {!busy && pendingCount > 0 ? (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          {pendingCount === 1
            ? "1 image ready to upload — it saves with the design."
            : `${pendingCount} images ready to upload — they save with the design.`}
        </Typography>
      ) : null}
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 0.5,
          fontWeight: error ? 700 : 400,
          color: error ? "error.main" : "text.secondary",
        }}
      >
        {error ??
          `${specSummary(DESIGN_IMAGE_SPEC)} · up to ${MAX_UPLOAD_BUDGET_MB} MB per upload in total — large photos are optimised automatically.`}
      </Typography>
    </>
  );
}

// One image tile. Every tile is removable — a photo picked by mistake has to be
// droppable before submitting, not only after it has been saved. `isNew` marks
// the ones that exist in the form and not yet on the design, with the NEW badge
// and a dashed edge.
function Thumbnail({
  src,
  alt,
  onRemove,
  isNew = false,
}: Readonly<{
  src: string;
  alt: string;
  onRemove: () => void;
  isNew?: boolean;
}>) {
  return (
    <Box
      sx={{
        position: "relative",
        width: 72,
        height: 90,
        borderRadius: 1,
        overflow: "hidden",
        border: isNew ? "1px dashed" : "1px solid",
        borderColor: isNew ? "primary.main" : "divider",
      }}
    >
      <Box
        component="img"
        src={src}
        alt={alt}
        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <IconButton
        size="small"
        aria-label={isNew ? `Remove ${alt || "image"}` : "Remove image"}
        onClick={onRemove}
        sx={{
          position: "absolute",
          top: 2,
          right: 2,
          bgcolor: "rgba(0,0,0,0.55)",
          color: "#fff",
          "&:hover": { bgcolor: "rgba(0,0,0,0.72)" },
        }}
      >
        <DeleteOutlineRounded sx={{ fontSize: 14 }} />
      </IconButton>
      {isNew ? (
        <Typography
          component="span"
          sx={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            py: 0.15,
            textAlign: "center",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.06em",
            color: "#fff",
            bgcolor: "primary.main",
          }}
        >
          NEW
        </Typography>
      ) : null}
    </Box>
  );
}

export function DesignImagesField({
  images,
  imageLimit,
  isFreePlan,
  // Field names are overridable so the same component can serve the design's
  // own images and a colour variation's, which post under different keys in the
  // same form. Defaults keep every existing caller unchanged.
  name = "image_files",
  urlsName = "image_urls",
}: {
  name?: string;
  urlsName?: string;
  images: string[];
  // null means unlimited, matching the plan's image_limit. Do not coerce it to a
  // number — a stand-in "big" cap would surface in the counter as a real one.
  imageLimit: number | null;
  isFreePlan: boolean;
}) {
  const [kept, setKept] = useState<string[]>(images);
  // How many of the picked images the plan cap left behind. The pick is capped
  // before resizing, so this is the only place the owner learns their choice was
  // trimmed — the counter alone would just look wrong.
  const [droppedByPlan, setDroppedByPlan] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Photos are resized in the browser before they reach the form body: this
  // form posts to a route action on Vercel, which refuses a request over 4.5 MB
  // before it gets there. See use-image-upload-field.ts.
  const uploads = useImageUploadField(inputRef);
  // Previews of the photos waiting to be uploaded, built from the RESIZED files
  // the hook holds — so what the owner sees is exactly the bytes that will be
  // uploaded. Showing the images rather than a list of filenames is the only
  // way she can confirm she picked the right ones: a filename from a phone
  // camera is "IMG_4821.jpg".
  const pending = useFilePreviews(uploads.files);
  const full = imageLimit !== null && kept.length >= imageLimit;
  const remaining =
    imageLimit === null ? undefined : Math.max(imageLimit - kept.length, 0);

  const pick = async (selected: FileList | null) => {
    const picked = Array.from(selected ?? []);
    // Room left counts the photos already staged as well as the saved ones,
    // otherwise a plan limit could be walked past one pick at a time.
    const room =
      remaining === undefined
        ? undefined
        : Math.max(remaining - pending.length, 0);
    setDroppedByPlan(
      room === undefined ? 0 : Math.max(picked.length - room, 0),
    );
    await uploads.prepare(picked, { maxFiles: remaining, append: true });
  };
  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
          Images
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {kept.length}
          {pending.length ? ` + ${pending.length} new` : ""}
          {imageLimit !== null ? ` of ${imageLimit} on your plan` : ""}
        </Typography>
      </Stack>
      <input type="hidden" name={urlsName} value={kept.join("\n")} />
      {kept.length > 0 || pending.length > 0 ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 1 }}>
          {/* Picked-but-unsaved photos sit in the same grid as the saved ones
              so the design reads as a whole; Thumbnail marks them NEW. */}
          {pending.map((item, index) => (
            <Thumbnail
              key={item.url}
              src={item.url}
              alt={item.file.name}
              isNew
              onRemove={() => uploads.remove(index)}
            />
          ))}
          {kept.map((url) => (
            <Thumbnail
              key={url}
              src={url}
              alt=""
              onRemove={() =>
                setKept((current) => current.filter((item) => item !== url))
              }
            />
          ))}
        </Stack>
      ) : null}
      <Button
        component="label"
        variant="outlined"
        size="small"
        startIcon={<AddRounded />}
        disabled={full || uploads.busy}
      >
        Add images
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void pick(event.target.files);
          }}
        />
      </Button>
      <UploadStatus
        busy={uploads.busy}
        error={uploads.error}
        pendingCount={pending.length}
      />
      {full ? (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          {isFreePlan ? (
            <>
              You've reached the {imageLimit}-image limit on the Free plan.{" "}
              <MuiLink component={RouterLink} to="/onboarding/billing">
                Upgrade
              </MuiLink>{" "}
              to add more.
            </>
          ) : (
            `Maximum ${imageLimit} images on your plan.`
          )}
        </Typography>
      ) : null}
      {droppedByPlan > 0 ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Only {imageLimit} images are allowed on your plan, so {droppedByPlan}{" "}
          of your selections {droppedByPlan === 1 ? "was" : "were"} left out.
        </Alert>
      ) : null}
    </Box>
  );
}
