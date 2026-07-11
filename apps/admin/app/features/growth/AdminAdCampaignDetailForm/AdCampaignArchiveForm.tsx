import { Form } from "react-router";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import type { AdminAdCampaign } from "../../../lib/api";

export function AdCampaignArchiveForm({
  campaign,
}: {
  campaign: AdminAdCampaign;
}) {
  const archived = campaign.status === "archived";

  return (
    <Form method="post">
      <input
        type="hidden"
        name="intent"
        value="admin-ad-campaign:archive"
      />
      <input type="hidden" name="campaign_id" value={campaign.campaignId} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          label="Archive reason"
          name="reason"
          size="small"
          placeholder="Placement completed"
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
