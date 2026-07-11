import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import MenuItem from "@mui/material/MenuItem";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { AdminProfileSettings } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { StyledTimeField } from "../shared/StyledTimeField";
import { BooleanPreference } from "./BooleanPreference";

export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: AdminProfileSettings["preferences"];
}) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Form method="post">
        <input
          type="hidden"
          name="intent"
          value="admin-preferences:update"
        />
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center" }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(tokens.warning, 0.12),
                color: tokens.warning,
              }}
            >
              <NotificationsActiveRounded />
            </Box>
            <Box>
              <Typography variant="h6">Notification settings</Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
              >
                Choose how this operator receives operational alerts.
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 180px" },
            }}
          >
            <TextField
              name="timezone"
              label="Timezone"
              select
              defaultValue={preferences.timezone}
              required
            >
              <MenuItem value="Africa/Accra">Africa/Accra</MenuItem>
              <MenuItem value="UTC">UTC</MenuItem>
              <MenuItem value="Europe/London">Europe/London</MenuItem>
              <MenuItem value="America/New_York">
                America/New York
              </MenuItem>
            </TextField>
            <TextField
              name="phone_number"
              label="SMS phone"
              defaultValue={preferences.phoneNumber}
              placeholder="+233501234567"
            />
            <StyledTimeField
              name="daily_digest_time"
              label="Digest time"
              defaultValue={preferences.dailyDigestTime}
              required
            />
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
            }}
          >
            <BooleanPreference
              name="notify_email"
              label="Email alerts"
              helper="Send urgent account and payment updates to your inbox."
              defaultChecked={preferences.notifyEmail}
            />
            <BooleanPreference
              name="notify_sms"
              label="SMS alerts"
              helper="Use phone alerts for time-sensitive operations."
              defaultChecked={preferences.notifySms}
            />
            <BooleanPreference
              name="alert_verifications"
              label="Verification queue"
              helper="Business identity, documents, and payout readiness."
              defaultChecked={preferences.alertVerifications}
            />
            <BooleanPreference
              name="alert_money_rails"
              label="Money rails"
              helper="Webhook failures, payout reviews, and settlement holds."
              defaultChecked={preferences.alertMoneyRails}
            />
            <BooleanPreference
              name="alert_subscriptions"
              label="Subscriptions"
              helper="Plan billing, grace periods, and package usage."
              defaultChecked={preferences.alertSubscriptions}
            />
            <BooleanPreference
              name="alert_promotions"
              label="Promotions"
              helper="Voucher rules and pending redemption activity."
              defaultChecked={preferences.alertPromotions}
            />
            <BooleanPreference
              name="alert_risk"
              label="Risk reviews"
              helper="Trust, safety, fraud, and compliance escalations."
              defaultChecked={preferences.alertRisk}
            />
            <BooleanPreference
              name="alert_support"
              label="Support queue"
              helper="Urgent tickets and customer-impacting requests."
              defaultChecked={preferences.alertSupport}
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            startIcon={<NotificationsActiveRounded />}
            sx={{ alignSelf: "flex-start" }}
          >
            Save notifications
          </Button>
        </Stack>
      </Form>
    </Panel>
  );
}
