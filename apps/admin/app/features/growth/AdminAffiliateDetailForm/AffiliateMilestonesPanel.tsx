import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "../../../components/form-text-field";
import type { AdminAffiliateAttribution } from "../../../lib/api";

export function AffiliateMilestonesPanel({
  performance,
}: {
  performance?: AdminAffiliateAttribution;
}) {
  if (!performance?.milestoneAchievements.length) return null;
  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">Milestone rewards</Typography>
      {performance.milestoneAchievements.map((achievement) => (
        <Box
          key={achievement.achievementId}
          sx={{
            p: 1.5,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Typography sx={{ fontWeight: 900 }}>
            {achievement.title} · {achievement.threshold} active referrals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {achievement.rewardDescription}
          </Typography>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-affiliate-milestone:update"
            />
            <input
              type="hidden"
              name="achievement_id"
              value={achievement.achievementId}
            />
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                select
                size="small"
                name="reward_status"
                label="Reward status"
                defaultValue={achievement.rewardStatus}
              >
                <MenuItem value="unfulfilled">Unfulfilled</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="fulfilled">Fulfilled</MenuItem>
                <MenuItem value="declined">Declined</MenuItem>
              </TextField>
              <TextField
                size="small"
                name="fulfilment_note"
                label="Fulfilment note"
                defaultValue={achievement.fulfilmentNote}
                helperText="Required when fulfilling or declining a reward."
              />
              <TextField
                required
                size="small"
                name="reason"
                label="Audit reason"
              />
              <Button
                type="submit"
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
              >
                Update reward
              </Button>
            </Stack>
          </Form>
        </Box>
      ))}
    </Stack>
  );
}
