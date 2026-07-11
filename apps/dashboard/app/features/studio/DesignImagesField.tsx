import { Link as RouterLink } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";

export function DesignImagesField({
  images,
  imageLimit,
  isFreePlan,
}: {
  images: string[];
  imageLimit: number;
  isFreePlan: boolean;
}) {
  const [kept, setKept] = useState<string[]>(images);
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  const full = kept.length >= imageLimit;
  const overLimit = kept.length + pendingNames.length > imageLimit;
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
          {pendingNames.length ? ` + ${pendingNames.length} new` : ""} of{" "}
          {imageLimit} on your plan
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
        disabled={full}
      >
        Add images
        <input
          type="file"
          name="image_files"
          accept="image/*"
          multiple
          hidden
          onChange={(event) =>
            setPendingNames(
              Array.from(event.target.files ?? []).map((file) => file.name),
            )
          }
        />
      </Button>
      {pendingNames.length > 0 ? (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          To upload: {pendingNames.join(", ")}
        </Typography>
      ) : null}
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
      {overLimit ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Only {imageLimit} images are allowed on your plan — extra selections
          will be rejected on save.
        </Alert>
      ) : null}
    </Box>
  );
}