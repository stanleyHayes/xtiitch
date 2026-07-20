package adminauthhttp

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type updateBusinessStatusRequest struct {
	OperationalStatus string `json:"operational_status"`
	Reason            string `json:"reason"`
}

type auditEventResponse struct {
	AuditEventID string `json:"audit_event_id"`
	ActorEmail   string `json:"actor_email"`
	ActorRole    string `json:"actor_role"`
	Action       string `json:"action"`
	TargetType   string `json:"target_type"`
	TargetID     string `json:"target_id"`
	TargetLabel  string `json:"target_label"`
	Summary      string `json:"summary"`
	Severity     string `json:"severity"`
	CreatedAt    string `json:"created_at"`
}

type businessResponse struct {
	BusinessID         string `json:"business_id"`
	Name               string `json:"name"`
	Handle             string `json:"handle"`
	OwnerName          string `json:"owner_name"`
	OwnerEmail         string `json:"owner_email"`
	Status             string `json:"status"`
	VerificationStatus string `json:"verification_status"`
	OperationalStatus  string `json:"operational_status"`
	Plan               string `json:"plan"`
	Orders             int    `json:"orders"`
	GMVMinor           int64  `json:"gmv_minor"`
	CommissionMinor    int64  `json:"commission_minor"`
	RiskLevel          string `json:"risk_level"`
	LastActive         string `json:"last_active"`
	SubaccountRef      string `json:"subaccount_ref"`
	SuspensionReason   string `json:"suspension_reason"`
	SuspendedAt        string `json:"suspended_at,omitempty"`
	UpdatedAt          string `json:"updated_at"`
}

func (handler Handler) businesses(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListBusinesses(r.Context(), adminauthapp.ListBusinessesCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]businessResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newBusinessResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]businessResponse{"businesses": out})
}

func (handler Handler) updateBusinessStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request updateBusinessStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.UpdateBusinessStatus(r.Context(), adminauthapp.UpdateBusinessStatusCommand{
		ActorUserID:       principal.AdminUserID,
		ActorRole:         principal.Role,
		BusinessID:        common.ID(chi.URLParam(r, "id")),
		OperationalStatus: business.OperationalStatus(request.OperationalStatus),
		Reason:            request.Reason,
		UserAgent:         r.UserAgent(),
		IPAddress:         requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newBusinessResponse(record))
}

// deleteBusiness is the §11.2 hard delete: it removes the business and ALL
// tenant-owned data (never the global customer identities). Like the
// neighbouring customer-erasure endpoint it needs a typed confirmation — the
// business's exact current name in ?confirm= — and the delete is audited.
func (handler Handler) deleteBusiness(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	record, err := handler.service.DeleteBusiness(r.Context(), adminauthapp.DeleteBusinessCommand{
		ActorUserID:      principal.AdminUserID,
		ActorRole:        principal.Role,
		BusinessID:       common.ID(chi.URLParam(r, "id")),
		ConfirmationName: r.URL.Query().Get("confirm"),
		UserAgent:        r.UserAgent(),
		IPAddress:        requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"business_id":  record.BusinessID.String(),
		"name":         record.Name,
		"handle":       record.Handle,
		"rows_deleted": record.TotalRowsDeleted,
		"deleted":      true,
	})
}

// businessActivity is the §11.3 full activity history: one newest-first feed
// across orders, payments, billing, payouts, verification, admin actions and
// manual takings, filtered by ?type= and paged with limit/offset.
func (handler Handler) businessActivity(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListBusinessActivity(r.Context(), adminauthapp.ListBusinessActivityCommand{
		ActorRole:  principal.Role,
		BusinessID: common.ID(chi.URLParam(r, "id")),
		Category:   strings.TrimSpace(r.URL.Query().Get("type")),
		Limit:      parsePayoutQueryLimit(r.URL.Query().Get("limit")),
		Offset:     parsePayoutQueryOffset(r.URL.Query().Get("offset")),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]businessActivityResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newBusinessActivityResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]businessActivityResponse{"activity": out})
}

type businessActivityResponse struct {
	EventType   string `json:"event_type"`
	Category    string `json:"category"`
	OccurredAt  string `json:"occurred_at"`
	Summary     string `json:"summary"`
	Actor       string `json:"actor"`
	RefID       string `json:"ref_id"`
	AmountMinor *int64 `json:"amount_minor,omitempty"`
}

func newBusinessActivityResponse(record ports.AdminBusinessActivityRecord) businessActivityResponse {
	return businessActivityResponse{
		EventType:   record.EventType,
		Category:    record.Category,
		OccurredAt:  record.OccurredAt.Format(time.RFC3339),
		Summary:     record.Summary,
		Actor:       record.Actor,
		RefID:       record.RefID,
		AmountMinor: record.AmountMinor,
	}
}

func (handler Handler) auditEvents(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	events, err := handler.service.ListAuditEvents(r.Context(), adminauthapp.ListAuditEventsCommand{
		ActorRole: principal.Role,
		Severity:  admindomain.AuditSeverity(strings.TrimSpace(r.URL.Query().Get("severity"))),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]auditEventResponse, 0, len(events))
	for _, event := range events {
		out = append(out, newAuditEventResponse(event))
	}
	writeJSON(w, http.StatusOK, map[string][]auditEventResponse{"events": out})
}

func newAuditEventResponse(event ports.AdminAuditEventRecord) auditEventResponse {
	return auditEventResponse{
		AuditEventID: event.AuditEventID.String(),
		ActorEmail:   event.ActorEmail,
		ActorRole:    string(event.ActorRole),
		Action:       event.Action,
		TargetType:   event.TargetType,
		TargetID:     event.TargetID,
		TargetLabel:  event.TargetLabel,
		Summary:      event.Summary,
		Severity:     string(event.Severity),
		CreatedAt:    event.CreatedAt.Format(time.RFC3339),
	}
}

func newBusinessResponse(record ports.AdminBusinessRecord) businessResponse {
	suspendedAt := ""
	if record.SuspendedAt != nil {
		suspendedAt = record.SuspendedAt.Format(time.RFC3339)
	}

	return businessResponse{
		BusinessID:         record.BusinessID.String(),
		Name:               record.Name,
		Handle:             record.Handle,
		OwnerName:          fallbackText(record.OwnerName, "Owner pending"),
		OwnerEmail:         fallbackText(record.OwnerEmail, "owner email pending"),
		Status:             businessListStatus(record),
		VerificationStatus: string(record.VerificationStatus),
		OperationalStatus:  string(record.OperationalStatus),
		Plan:               fallbackText(record.PlanName, record.PlanCode),
		Orders:             record.OrdersCount,
		GMVMinor:           record.GMVMinor,
		CommissionMinor:    record.CommissionMinor,
		RiskLevel:          businessRiskLevel(record),
		LastActive:         record.LastActiveAt.Format(time.RFC3339),
		SubaccountRef:      record.SettlementSubaccount,
		SuspensionReason:   record.SuspensionReason,
		SuspendedAt:        suspendedAt,
		UpdatedAt:          record.UpdatedAt.Format(time.RFC3339),
	}
}

func businessListStatus(record ports.AdminBusinessRecord) string {
	if record.OperationalStatus == business.OperationalStatusSuspended {
		return string(business.OperationalStatusSuspended)
	}
	return string(record.VerificationStatus)
}

func businessRiskLevel(record ports.AdminBusinessRecord) string {
	if record.OperationalStatus == business.OperationalStatusSuspended ||
		record.VerificationStatus == business.VerificationStatusRejected {
		return "high"
	}
	if record.VerificationStatus != business.VerificationStatusVerified ||
		strings.TrimSpace(record.SettlementSubaccount) == "" {
		return "medium"
	}
	return "low"
}
