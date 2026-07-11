import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { tokens } from "../../theme";
import { Panel, SectionHeader, PaginationFooter } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import type { AdminSession } from "../../lib/session";
import {
  AdminSupportTicket,
  AdminActionFeedback,
} from "../shared/types";
import { shortTime } from "../shared/dates";

export function SupportTicketsSection({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  supportTickets,
  supportQueueError,
  actionData,
  admin,
}: {
  supportTickets: AdminSupportTicket[];
  supportQueueError: string | null;
  actionData?: AdminActionFeedback;
  admin: AdminSession;
}) {
  const {
    page: supportPage,
    pageCount: supportPageCount,
    pagedItems: pagedSupportTickets,
    setPage: setSupportPage,
  } = usePagedItems(supportTickets, 6, supportTickets.length);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Operator support"
        title="Support queue"
        helper="Prioritise payment, delivery, and tracking issues before they become trust problems."
      />
      {actionData?.section === "support" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {supportQueueError ? (
        <Alert severity="warning">{supportQueueError}</Alert>
      ) : null}
      <Stack spacing={1.5}>
        {pagedSupportTickets.map((ticket) => { // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
          const resolved = ticket.status === "resolved";
          const assignedToMe = ticket.assignedAdminEmail === admin.adminEmail;
          const assignee =
            ticket.assignedAdminName || ticket.assignedAdminEmail;
          return (
            <Panel
              key={ticket.id}
              sx={{
                p: 2.5,
                borderColor: alpha(
                  ticket.priority === "urgent" ? tokens.danger : tokens.info,
                  ticket.priority === "urgent" ? 0.28 : 0.18,
                ),
                backgroundImage: `
                  linear-gradient(90deg, ${alpha(
                    ticket.priority === "urgent"
                      ? tokens.danger
                      : tokens.info,
                    ticket.priority === "urgent" ? 0.09 : 0.06,
                  )}, transparent 38%),
                  linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
                `,
                opacity: resolved ? 0.72 : 1,
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.09)}`,
                },
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography variant="h6">{ticket.subject}</Typography>
                    <Chip
                      size="small"
                      label={ticket.priority}
                      sx={{
                        bgcolor: alpha(
                          ticket.priority === "urgent"
                            ? tokens.danger
                            : tokens.info,
                          0.12,
                        ),
                        color:
                          ticket.priority === "urgent"
                            ? tokens.danger
                            : tokens.info,
                        textTransform: "capitalize",
                      }}
                    />
                    {resolved ? (
                      <Chip
                        size="small"
                        label="resolved"
                        sx={{ color: tokens.success }}
                      />
                    ) : null}
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary" }}
                  >
                    {ticket.category} · {ticket.business} · opened{" "}
                    {shortTime(ticket.createdAt)}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>{ticket.summary}</Typography>
                  {assignee ? (
                    <Chip
                      size="small"
                      icon={<AssignmentTurnedInRounded />}
                      label={`Assigned to ${assignee}`}
                      sx={{
                        mt: 1.5,
                        bgcolor: alpha(tokens.success, 0.1),
                        color: tokens.success,
                      }}
                    />
                  ) : null}
                </Box>
                <Stack
                  direction={{ xs: "row", md: "column" }}
                  spacing={1}
                  sx={{
                    alignSelf: { md: "center" },
                    flexWrap: "wrap",
                    minWidth: { md: 180 },
                  }}
                >
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-support-ticket:update"
                    />
                    <input
                      type="hidden"
                      name="ticket_key"
                      value={ticket.id}
                    />
                    <input type="hidden" name="status" value="open" />
                    <input
                      type="hidden"
                      name="assignment"
                      value={assignedToMe ? "unassigned" : "self"}
                    />
                    <input
                      type="hidden"
                      name="note"
                      value={
                        assignedToMe
                          ? `Unassigned ${ticket.subject}`
                          : `Assigned ${ticket.subject}`
                      }
                    />
                    <Button
                      type="submit"
                      variant={assignedToMe ? "outlined" : "contained"}
                      startIcon={<SupportAgentRounded />}
                      fullWidth
                    >
                      {assignedToMe ? "Unassign" : "Assign to me"}
                    </Button>
                  </Form>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-support-ticket:update"
                    />
                    <input
                      type="hidden"
                      name="ticket_key"
                      value={ticket.id}
                    />
                    <input
                      type="hidden"
                      name="status"
                      value={resolved ? "open" : "resolved"}
                    />
                    <input
                      type="hidden"
                      name="assignment"
                      value="unchanged"
                    />
                    <input
                      type="hidden"
                      name="note"
                      value={
                        resolved
                          ? `Reopened ${ticket.subject}`
                          : `Resolved ${ticket.subject}`
                      }
                    />
                    <Button
                      type="submit"
                      variant="outlined"
                      startIcon={
                        resolved ? (
                          <SupportAgentRounded />
                        ) : (
                          <CheckCircleRounded />
                        )
                      }
                      fullWidth
                    >
                      {resolved ? "Reopen" : "Resolve"}
                    </Button>
                  </Form>
                </Stack>
              </Stack>
            </Panel>
          );
        })}
        {!supportQueueError && supportTickets.length === 0 ? (
          <Box
            sx={{
              p: 2,
              border: "1px dashed",
              borderColor: alpha(tokens.success, 0.28),
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb), 0.68)",
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>
              No support tickets need action.
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Failed payments, delayed messages, stale orders, overdue visits,
              and handover follow-ups will appear here.
            </Typography>
          </Box>
        ) : null}
        <PaginationFooter
          count={supportPageCount}
          label="support tickets"
          page={supportPage}
          pageSize={6}
          total={supportTickets.length}
          onChange={setSupportPage}
        />
      </Stack>
    </Stack>
  );
}
