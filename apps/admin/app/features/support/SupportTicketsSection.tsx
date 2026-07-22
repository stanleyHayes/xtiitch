import { Form, useSearchParams } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import { tokens } from "../../theme";
import { AdminEmptyState, AdminRecordPage, PaginationFooter, Panel, SectionHeader } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import type { AdminSession } from "../../lib/session";
import { AdminSupportTicket, AdminActionFeedback } from "../shared/types";
import { shortTime } from "../shared/dates";

function TicketActions({ ticket, admin }: { ticket: AdminSupportTicket; admin: AdminSession }) {
  const resolved = ticket.status === "resolved";
  const assigned = ticket.assignedAdminEmail === admin.adminEmail;
  return <>
    <Form method="post"><input type="hidden" name="intent" value="admin-support-ticket:update" /><input type="hidden" name="ticket_key" value={ticket.id} /><input type="hidden" name="status" value="open" /><input type="hidden" name="assignment" value={assigned ? "unassigned" : "self"} /><input type="hidden" name="note" value={assigned ? `Unassigned ${ticket.subject}` : `Assigned ${ticket.subject}`} /><Button type="submit" variant={assigned ? "outlined" : "contained"} startIcon={<SupportAgentRounded />} sx={{ whiteSpace: "nowrap" }}>{assigned ? "Unassign" : "Assign to me"}</Button></Form>
    <Form method="post"><input type="hidden" name="intent" value="admin-support-ticket:update" /><input type="hidden" name="ticket_key" value={ticket.id} /><input type="hidden" name="status" value={resolved ? "open" : "resolved"} /><input type="hidden" name="assignment" value="unchanged" /><input type="hidden" name="note" value={resolved ? `Reopened ${ticket.subject}` : `Resolved ${ticket.subject}`} /><Button type="submit" variant="outlined" startIcon={<CheckCircleRounded />} sx={{ whiteSpace: "nowrap" }}>{resolved ? "Reopen" : "Resolve"}</Button></Form>
  </>;
}

export function SupportTicketsSection({ supportTickets, supportQueueError, actionData, admin }: { supportTickets: AdminSupportTicket[]; supportQueueError: string | null; actionData?: AdminActionFeedback; admin: AdminSession; }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("ticket");
  const selected = supportTickets.find((item) => item.id === selectedId) ?? null;
  const { page, pageCount, pagedItems, setPage } = usePagedItems(supportTickets, 8, supportTickets.length);
  const close = () => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("ticket"); return next; });
  if (selected) {
    const color = selected.priority === "urgent" ? tokens.danger : tokens.info;
    return <AdminRecordPage eyebrow={`${selected.category} support`} title={selected.subject} helper={`${selected.business} · opened ${shortTime(selected.createdAt)}`} status={selected.status} statusColor={color} onBack={close} actions={<TicketActions ticket={selected} admin={admin} />}>
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(260px, .65fr)" } }}>
        <Box><Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 900 }}>Customer issue</Typography><Typography sx={{ mt: 1, fontSize: 18 }}>{selected.summary}</Typography></Box>
        <Stack spacing={1} sx={{ p: 2, border: "1px solid", borderColor: alpha(color, .2), borderRadius: 2, bgcolor: alpha(color, .06) }}><Typography variant="overline" sx={{ color, fontWeight: 900 }}>Ownership</Typography><Typography sx={{ fontWeight: 900 }}>{selected.assignedAdminName || selected.assignedAdminEmail || "Unassigned"}</Typography><Typography variant="body2" sx={{ color: "text.secondary" }}>Priority: {selected.priority}</Typography></Stack>
      </Box>
    </AdminRecordPage>;
  }
  return <Stack spacing={2.5}>
    <SectionHeader eyebrow="Operational inbox" title="Support queue" helper="Payment, delivery, and tracking issues in one clean list. Open a ticket for the full context and controls." />
    {actionData?.section === "support" && actionData.message ? <Alert severity={actionData.severity ?? "success"}>{actionData.message}</Alert> : null}{supportQueueError ? <Alert severity="warning">{supportQueueError}</Alert> : null}
    <Panel sx={{ overflow: "hidden" }}>{pagedItems.map((ticket, index) => { const color = ticket.priority === "urgent" ? tokens.danger : tokens.info; return <Box key={ticket.id} component="button" type="button" onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("ticket", ticket.id); return next; })} sx={{ width: "100%", p: { xs: 2, md: 2.25 }, display: "grid", gridTemplateColumns: { xs: "auto 1fr auto", md: "auto minmax(0, 1.3fr) minmax(180px, .7fr) auto" }, gap: 1.5, alignItems: "center", border: 0, borderBottom: index === pagedItems.length - 1 ? 0 : "1px solid", borderColor: "divider", bgcolor: "transparent", color: "text.primary", textAlign: "left", cursor: "pointer", font: "inherit", opacity: ticket.status === "resolved" ? .65 : 1, "&:hover": { bgcolor: alpha(color, .055) } }}><Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: alpha(color, .11), color }}><SupportAgentRounded /></Box><Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 900 }}>{ticket.subject}</Typography><Chip size="small" label={ticket.priority} sx={{ bgcolor: alpha(color, .1), color, textTransform: "capitalize" }} /></Stack><Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.summary}</Typography></Box><Box sx={{ display: { xs: "none", md: "block" } }}><Typography variant="body2" sx={{ fontWeight: 800 }}>{ticket.business}</Typography><Typography variant="caption" sx={{ color: "text.secondary" }}>{shortTime(ticket.createdAt)}</Typography></Box><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>{ticket.assignedAdminEmail ? <AssignmentTurnedInRounded fontSize="small" sx={{ color: tokens.success }} /> : null}<ArrowForwardRounded sx={{ color }} /></Stack></Box>; })}{supportTickets.length === 0 ? <AdminEmptyState compact icon={<SupportAgentRounded />} eyebrow="Support queue" title="Inbox cleared" helper="New customer issues will appear here as they arrive." /> : null}</Panel>
    <PaginationFooter count={pageCount} label="support tickets" page={page} pageSize={8} total={supportTickets.length} onChange={setPage} />
  </Stack>;
}
