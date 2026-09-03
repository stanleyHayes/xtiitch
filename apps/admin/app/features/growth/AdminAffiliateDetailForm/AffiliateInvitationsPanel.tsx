import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { AdminAffiliateAttribution } from "../../../lib/api";
import { shortTime } from "../../shared/dates";

export function AffiliateInvitationsPanel({ performance }: { performance?: AdminAffiliateAttribution }) {
  const invitations = performance?.invitations ?? [];
  return (
    <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="h6">Affiliate invitations</Typography>
      <Typography variant="body2" color="text.secondary">
        Non-financial, single-level invitation history. No commission or milestone credit is created here.
      </Typography>
      {invitations.length ? (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {invitations.map((invitation) => (
            <Stack key={invitation.invitationId} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", p: 1, bgcolor: "rgba(var(--surface-rgb), 0.7)", borderRadius: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>{invitation.acceptedDisplayName || invitation.inviteeEmail}</Typography>
                <Typography variant="body2" color="text.secondary">Invited {shortTime(invitation.createdAt)}{invitation.acceptedAt ? ` · Joined ${shortTime(invitation.acceptedAt)}` : ""}</Typography>
              </Box>
              <Chip size="small" variant="outlined" label={invitation.acceptedAt ? "Joined" : "Pending"} />
            </Stack>
          ))}
        </Stack>
      ) : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No Affiliate invitations yet.</Typography>}
    </Box>
  );
}
