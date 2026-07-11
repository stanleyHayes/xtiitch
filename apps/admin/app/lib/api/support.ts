import { requestJSON } from "./utils";

export type AdminSupportPriority = "normal" | "urgent";
export type AdminSupportTicketStatus = "open" | "resolved";
export type AdminSupportAssignment = "self" | "unassigned" | "unchanged";
export type AdminSupportTicket = {
  id: string;
  businessId: string;
  subject: string;
  business: string;
  priority: AdminSupportPriority;
  summary: string;
  category: string;
  status: AdminSupportTicketStatus;
  assignedAdminUserId?: string;
  assignedAdminEmail?: string;
  assignedAdminName?: string;
  createdAt: string;
  updatedAt: string;
};
type AdminSupportTicketPayload = {
  ticket_key: string;
  business_id: string;
  subject: string;
  business: string;
  priority: AdminSupportPriority;
  summary: string;
  category: string;
  status: AdminSupportTicketStatus;
  assigned_admin_user_id?: string;
  assigned_admin_email?: string;
  assigned_admin_name?: string;
  created_at: string;
  updated_at: string;
};
function mapSupportTicket(
  payload: AdminSupportTicketPayload,
): AdminSupportTicket {
  return {
    id: payload.ticket_key,
    businessId: payload.business_id,
    subject: payload.subject,
    business: payload.business,
    priority: payload.priority,
    summary: payload.summary,
    category: payload.category,
    status: payload.status,
    assignedAdminUserId: payload.assigned_admin_user_id,
    assignedAdminEmail: payload.assigned_admin_email,
    assignedAdminName: payload.assigned_admin_name,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const supportApi = {
  supportTickets: async (accessToken: string) => {
    const payload = await requestJSON<{ tickets: AdminSupportTicketPayload[] }>(
      "/admin/support-tickets",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.tickets.map(mapSupportTicket);
  },
  updateSupportTicket: (
    accessToken: string,
    ticketKey: string,
    input: {
      status: AdminSupportTicketStatus;
      assignment: AdminSupportAssignment;
      note: string;
    },
  ) =>
    requestJSON<AdminSupportTicketPayload>(
      `/admin/support-tickets/${encodeURIComponent(ticketKey)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          assignment: input.assignment,
          note: input.note,
        }),
      },
    ).then(mapSupportTicket),
};
