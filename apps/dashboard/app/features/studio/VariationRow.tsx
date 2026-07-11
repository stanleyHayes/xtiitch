import { useFetcher } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import TextField from "../../components/form-text-field";
import type { DesignVariation } from "../../lib/api";
import { DesignExtrasData } from "../shared/types";
import { DesignImagesField } from "./DesignImagesField";

export function VariationRow({
  variation,
  index,
  total,
  actionUrl,
  write,
  imageLimit,
  isFreePlan,
  onReorder,
}: {
  variation: DesignVariation;
  index: number;
  total: number;
  actionUrl: string;
  write: ReturnType<typeof useFetcher<DesignExtrasData>>;
  imageLimit: number;
  isFreePlan: boolean;
  onReorder: (index: number, direction: -1 | 1) => void;
}) {
  const deleteVariation = () => {
    const body = new FormData();
    body.set("op", "delete_variation");
    body.set("variation_id", variation.variation_id);
    write.submit(body, { method: "post", action: actionUrl });
  };
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <write.Form method="post" action={actionUrl} encType="multipart/form-data">
        <input type="hidden" name="op" value="update_variation" />
        <input
          type="hidden"
          name="variation_id"
          value={variation.variation_id}
        />
        <Stack spacing={1.25}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center" }}
          >
            <TextField
              name="name"
              label="Colour / variation name"
              defaultValue={variation.name}
              size="small"
              required
              sx={{ flex: 1 }}
            />
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  onClick={() => onReorder(index, -1)}
                >
                  <ArrowUpwardRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  disabled={index === total - 1}
                  onClick={() => onReorder(index, 1)}
                >
                  <ArrowDownwardRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <DesignImagesField
            key={variation.images.join("|")}
            images={variation.images}
            imageLimit={imageLimit}
            isFreePlan={isFreePlan}
          />
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button
              type="button"
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineRounded />}
              onClick={deleteVariation}
            >
              Delete
            </Button>
            <Button type="submit" size="small" variant="contained">
              Save variation
            </Button>
          </Stack>
        </Stack>
      </write.Form>
    </Box>
  );
}