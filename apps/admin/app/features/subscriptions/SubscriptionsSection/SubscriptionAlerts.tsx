import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { AdminActionFeedback } from "../../shared/types";

export function SubscriptionAlerts({
  actionData,
  subscriptionsError,
  hasSubscriptions,
}: {
  actionData?: AdminActionFeedback;
  subscriptionsError: string | null;
  hasSubscriptions: boolean;
}) {
  return (
    <>
      {actionData?.section === "subscriptions" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          <Stack spacing={0.75}>
            <span>{actionData.message}</span>
            {actionData.detail ? (
              <Typography variant="body2" sx={{ color: "inherit" }}>
                {actionData.detail}
              </Typography>
            ) : null}
            {actionData.href ? (
              <Button
                component="a"
                href={actionData.href}
                target="_blank"
                rel="noreferrer"
                size="small"
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                sx={{ alignSelf: "flex-start" }}
              >
                {actionData.hrefLabel ?? "Open link"}
              </Button>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      {subscriptionsError ? (
        <Alert severity="warning">{subscriptionsError}</Alert>
      ) : null}
      {!subscriptionsError && !hasSubscriptions ? (
        <Alert severity="info">
          No subscription records are available yet.
        </Alert>
      ) : null}
    </>
  );
}
