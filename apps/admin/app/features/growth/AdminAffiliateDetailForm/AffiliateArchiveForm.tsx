import { Form } from "react-router";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import type { AdminAffiliate } from "../../../lib/api";

export function AffiliateArchiveForm({
  affiliate,
}: {
  affiliate: AdminAffiliate;
}) {
  const archived = affiliate.status === "archived";

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-affiliate:archive" />
      <input
        type="hidden"
        name="affiliate_id"
        value={affiliate.affiliateId}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          label="Archive reason"
          name="reason"
          size="small"
          placeholder="Programme closed"
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
