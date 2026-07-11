import { Form } from "react-router";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import type { Design } from "../../../lib/api";
import { CopyLinkButton } from "../CopyLinkButton";

export function RowActions({
  design,
  storeHandle,
  onEdit,
}: {
  design: Design;
  storeHandle: string;
  onEdit: () => void;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{
        gridColumn: { xs: "1 / -1", sm: "auto" },
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <CopyLinkButton
        url={`https://${storeHandle}.xtiitch.com/design/${design.handle}`}
        label="Copy design link"
      />
      <Button
        type="button"
        variant="outlined"
        size="small"
        endIcon={<ArrowForwardRounded fontSize="small" />}
        onClick={onEdit}
      >
        Edit design
      </Button>
    </Stack>
  );
}

export function DialogActions({ design }: { design: Design }) {
  const retired = design.status === "retired";
  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Retire hides the piece from customers. Remove deletes it from the
          dashboard list.
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "flex-end" }}
        >
          <Form method="post">
            <input type="hidden" name="id" value={design.design_id} />
            <input
              type="hidden"
              name="intent"
              value={retired ? "restore" : "retire"}
            />
            <Button
              type="submit"
              size="small"
              variant="outlined"
              color={retired ? "primary" : "inherit"}
            >
              {retired ? "Restore" : "Retire"}
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="id" value={design.design_id} />
            <input type="hidden" name="intent" value="delete_design" />
            <Button
              type="submit"
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineRounded />}
            >
              Remove
            </Button>
          </Form>
        </Stack>
      </Stack>
    </>
  );
}
