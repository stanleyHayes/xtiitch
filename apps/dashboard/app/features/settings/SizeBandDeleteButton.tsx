import { Form } from "react-router";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { SizeBand } from "../shared/types";

export function SizeBandDeleteButton({ band }: { band: SizeBand }) {
  return (
    <Form
      method="post"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete size band "${band.label}"? This also removes its design prices.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="intent" value="delete_size_band" />
      <input type="hidden" name="size_band_id" value={band.size_band_id} />
      <Tooltip title="Delete size band">
        <IconButton
          type="submit"
          color="error"
          size="small"
          aria-label={`Delete ${band.label}`}
        >
          <DeleteOutlineRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Form>
  );
}