import { Form } from "react-router";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import type { AdminPromotion } from "../../../lib/api";

export function PromotionArchiveForm({
  promotion,
}: {
  promotion: AdminPromotion;
}) {
  const archived = promotion.status === "archived";

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-promotion:archive" />
      <input
        type="hidden"
        name="promotion_id"
        value={promotion.promotionId}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          label="Archive reason"
          name="reason"
          size="small"
          placeholder="Campaign ended"
          fullWidth
          disabled={archived}
        />
        <Button
          type="submit"
          variant="outlined"
          color="warning"
          disabled={archived}
          sx={{ minWidth: { sm: 140 } }}
        >
          Archive
        </Button>
      </Stack>
    </Form>
  );
}
