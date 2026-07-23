import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import { tokens } from "../../../theme";
import { AdminEmptyState } from "../../../components/ui/AdminEmptyState";
import { Panel } from "../../../components/ui/Panel";
import { shortTime } from "../../shared/dates";
import type { AdminSubscriptionEvent } from "../../../lib/api";

export function SubscriptionEventsPanel({
  events,
  onSelectMoney,
}: {
  events: (AdminSubscriptionEvent & { businessName: string })[];
  onSelectMoney: () => void;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.info, 0.18),
        backgroundImage: `
          radial-gradient(circle at 96% 0%, ${alpha(tokens.info, 0.14)}, transparent 35%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <WorkspacePremiumRounded sx={{ color: tokens.burgundy }} />
          <Box>
            <Typography variant="h6">Subscription events</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Latest operator lifecycle changes.
            </Typography>
          </Box>
        </Stack>
        <Divider />
        {events.length === 0 ? (
          <AdminEmptyState
            icon={<WorkspacePremiumRounded />}
            eyebrow="Lifecycle events"
            title="No lifecycle events yet"
            helper="Plan activations, renewals, upgrades, downgrades, cancellations, and payment callbacks will be recorded here once they happen."
            action={
              <Button
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                onClick={onSelectMoney}
                sx={{ whiteSpace: "nowrap" }}
              >
                Review money rails
              </Button>
            }
          />
        ) : null}
        {events.map((event) => (
          <Box
            key={event.id}
            sx={{
              p: 1.3,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.08),
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb), 0.7)",
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>
              {event.businessName}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {event.summary}
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
            >
              {shortTime(event.createdAt)} · {event.actorEmail || "System"}
            </Typography>
          </Box>
        ))}
        {events.length > 0 ? (
          <Button
            variant="outlined"
            endIcon={<ArrowForwardRounded />}
            onClick={onSelectMoney}
            sx={{ whiteSpace: "nowrap" }}
          >
            Review money rails
          </Button>
        ) : null}
      </Stack>
    </Panel>
  );
}
