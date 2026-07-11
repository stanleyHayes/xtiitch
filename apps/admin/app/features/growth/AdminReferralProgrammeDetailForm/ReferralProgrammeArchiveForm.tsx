import { Form } from "react-router";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import type { AdminReferralProgramme } from "../../../lib/api";

export function ReferralProgrammeArchiveForm({
  programme,
}: {
  programme: AdminReferralProgramme;
}) {
  const archived = programme.status === "archived";

  return (
    <Form method="post">
      <input
        type="hidden"
        name="intent"
        value="admin-referral-programme:archive"
      />
      <input
        type="hidden"
        name="programme_id"
        value={programme.programmeId}
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
