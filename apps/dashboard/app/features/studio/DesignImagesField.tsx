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
import { MAX_UPLOAD_BUDGET_MB } from "../../lib/upload-limits";
import { DESIGN_IMAGE_SPEC, specSummary } from "../../lib/image-specs";

// The line under the "Add images" button: a skeleton while photos are being
// resized, then either what went wrong or the size ceiling. The ceiling is
// stated up front rather than only on failure, so nobody has to discover it by
// hitting it.
function UploadStatus({
  busy,
  error,
  pendingNames,
}: Readonly<{ busy: boolean; error: string | null; pendingNames: string[] }>) {
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
      {!busy && pendingNames.length > 0 ? (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          To upload: {pendingNames.join(", ")}
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

export function DesignImagesField({
  images,
  imageLimit,
  isFreePlan,
}: {
  images: string[];
  // null means unlimited, matching the plan's image_limit. Do not coerce it to a
  // number — a stand-in "big" cap would surface in the counter as a real one.
  imageLimit: number | null;
  isFreePlan: boolean;
}) {
  const [kept, setKept] = useState<string[]>(images);
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  // How many of the picked images the plan cap left behind. The pick is capped
  // before resizing, so this is the only place the owner learns their choice was
  // trimmed — the counter alone would just look wrong.
  const [droppedByPlan, setDroppedByPlan] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Photos are resized in the browser before they reach the form body: this
  // form posts to a route action on Vercel, which refuses a request over 4.5 MB
  // before it gets there. See use-image-upload-field.ts.
  const uploads = useImageUploadField(inputRef);
  const full = imageLimit !== null && kept.length >= imageLimit;
  const remaining =
    imageLimit === null ? undefined : Math.max(imageLimit - kept.length, 0);

  const pick = async (selected: FileList | null) => {
    const picked = Array.from(selected ?? []);
    setDroppedByPlan(
      remaining === undefined ? 0 : Math.max(picked.length - remaining, 0),
    );
    setPendingNames((await uploads.prepare(picked, remaining)).map((f) => f.name));
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
          {pendingNames.length ? ` + ${pendingNames.length} new` : ""}
          {imageLimit !== null ? ` of ${imageLimit} on your plan` : ""}
        </Typography>
      </Stack>
      <input type="hidden" name="image_urls" value={kept.join("\n")} />
      {kept.length > 0 ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 1 }}>
          {kept.map((url) => (
            <Box
              key={url}
              sx={{
                position: "relative",
                width: 72,
                height: 90,
                borderRadius: 1,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box
                component="img"
                src={url}
                alt=""
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <IconButton
                size="small"
                aria-label="Remove image"
                onClick={() =>
                  setKept((current) => current.filter((item) => item !== url))
                }
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
            </Box>
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
          name="image_files"
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
        pendingNames={pendingNames}
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