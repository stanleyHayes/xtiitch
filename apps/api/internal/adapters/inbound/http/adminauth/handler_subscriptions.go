package adminauthhttp

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (handler Handler) subscriptions(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListSubscriptions(r.Context(), adminauthapp.ListSubscriptionsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]subscriptionResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newSubscriptionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]subscriptionResponse{"subscriptions": out})
}

func (handler Handler) updateSubscription(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionUpdateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateSubscription(r.Context(), adminauthapp.UpdateSubscriptionCommand{
		ActorUserID:             principal.AdminUserID,
		ActorRole:               principal.Role,
		BusinessID:              common.ID(chi.URLParam(r, "id")),
		Status:                  request.Status,
		BillingMode:             request.BillingMode,
		ProviderCustomerRef:     request.ProviderCustomerRef,
		ProviderSubscriptionRef: request.ProviderSubscriptionRef,
		Reason:                  request.Reason,
		UserAgent:               r.UserAgent(),
		IPAddress:               requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionResponse(record))
}

func (handler Handler) issueSubscriptionInvoice(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionInvoiceIssueRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.IssueSubscriptionInvoice(r.Context(), adminauthapp.IssueSubscriptionInvoiceCommand{
		ActorUserID:        principal.AdminUserID,
		ActorRole:          principal.Role,
		BusinessID:         common.ID(chi.URLParam(r, "id")),
		ProviderInvoiceRef: request.ProviderInvoiceRef,
		PaymentURL:         request.PaymentURL,
		DueAt:              request.DueAt,
		Reason:             request.Reason,
		UserAgent:          r.UserAgent(),
		IPAddress:          requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newSubscriptionResponse(record))
}

func (handler Handler) markSubscriptionInvoicePaid(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionInvoiceDecisionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.MarkSubscriptionInvoicePaid(r.Context(), adminauthapp.MarkSubscriptionInvoicePaidCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		InvoiceID:   common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionResponse(record))
}

func (handler Handler) markSubscriptionInvoiceFailed(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionInvoiceDecisionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.MarkSubscriptionInvoiceFailed(r.Context(), adminauthapp.MarkSubscriptionInvoiceFailedCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		InvoiceID:   common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionResponse(record))
}

func (handler Handler) runSubscriptionBillingSweep(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionBillingSweepRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.RunSubscriptionBillingSweep(r.Context(), adminauthapp.RunSubscriptionBillingSweepCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionBillingSweepResponse(record))
}

func (handler Handler) runSubscriptionRecurringSweep(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionBillingSweepRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.RunSubscriptionRecurringSweep(r.Context(), adminauthapp.RunSubscriptionRecurringSweepCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionRecurringSweepResponse(record))
}

func (handler Handler) initializeSubscriptionAuthorization(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionAuthorizationInitRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	result, err := handler.service.InitializeSubscriptionAuthorization(
		r.Context(),
		adminauthapp.InitializeSubscriptionAuthorizationCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			BusinessID:  common.ID(chi.URLParam(r, "id")),
			CallbackURL: request.CallbackURL,
			Reason:      request.Reason,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newSubscriptionAuthorizationLinkResponse(result))
}

func (handler Handler) verifySubscriptionAuthorization(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request subscriptionAuthorizationVerifyRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.VerifySubscriptionAuthorization(
		r.Context(),
		adminauthapp.VerifySubscriptionAuthorizationCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			BusinessID:  common.ID(chi.URLParam(r, "id")),
			Reference:   request.Reference,
			Reason:      request.Reason,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSubscriptionResponse(record))
}

func newSubscriptionResponse(record ports.AdminSubscriptionRecord) subscriptionResponse {
	events := make([]subscriptionEventResponse, 0, len(record.Events))
	for _, event := range record.Events {
		events = append(events, subscriptionEventResponse{
			SubscriptionEventID: event.SubscriptionEventID.String(),
			EventType:           event.EventType,
			Summary:             event.Summary,
			ActorEmail:          event.ActorEmail,
			CreatedAt:           event.CreatedAt.Format(time.RFC3339),
		})
	}
	invoices := make([]subscriptionInvoiceResponse, 0, len(record.Invoices))
	for _, invoice := range record.Invoices {
		invoices = append(invoices, subscriptionInvoiceResponse{
			InvoiceID:          invoice.InvoiceID.String(),
			SubscriptionID:     invoice.SubscriptionID.String(),
			InvoiceRef:         invoice.InvoiceRef,
			Status:             invoice.Status,
			BillingMode:        invoice.BillingMode,
			Provider:           invoice.Provider,
			ProviderInvoiceRef: invoice.ProviderInvoiceRef,
			PaymentURL:         invoice.PaymentURL,
			AmountMinor:        invoice.AmountMinor,
			Currency:           invoice.Currency,
			PeriodStart:        invoice.PeriodStart.Format(time.RFC3339),
			PeriodEnd:          invoice.PeriodEnd.Format(time.RFC3339),
			DueAt:              invoice.DueAt.Format(time.RFC3339),
			PaidAt:             optionalTimeString(invoice.PaidAt),
			FailedAt:           optionalTimeString(invoice.FailedAt),
			FailureReason:      invoice.FailureReason,
			CreatedAt:          invoice.CreatedAt.Format(time.RFC3339),
			UpdatedAt:          invoice.UpdatedAt.Format(time.RFC3339),
		})
	}

	return subscriptionResponse{
		SubscriptionID:          record.SubscriptionID.String(),
		BusinessID:              record.BusinessID.String(),
		BusinessName:            record.BusinessName,
		Handle:                  record.Handle,
		OwnerName:               record.OwnerName,
		OwnerPhone:              record.OwnerPhone,
		OwnerEmail:              record.OwnerEmail,
		OwnerWhatsApp:           record.OwnerWhatsApp,
		PlanCode:                record.PlanCode,
		PlanName:                record.PlanName,
		MonthlyFeeMinor:         record.MonthlyFeeMinor,
		CommissionBPS:           record.CommissionBPS,
		DesignLimit:             record.DesignLimit,
		DesignCount:             record.DesignCount,
		Status:                  record.Status,
		BillingMode:             record.BillingMode,
		BillingCadence:          record.BillingCadence,
		Provider:                record.Provider,
		ProviderCustomerRef:     record.ProviderCustomerRef,
		ProviderSubscriptionRef: record.ProviderSubscriptionRef,
		CurrentPeriodStart:      record.CurrentPeriodStart.Format(time.RFC3339),
		CurrentPeriodEnd:        record.CurrentPeriodEnd.Format(time.RFC3339),
		TrialEndsAt:             optionalTimeString(record.TrialEndsAt),
		GraceEndsAt:             optionalTimeString(record.GraceEndsAt),
		CancelAtPeriodEnd:       record.CancelAtPeriodEnd,
		CanceledAt:              optionalTimeString(record.CanceledAt),
		FailedPaymentCount:      record.FailedPaymentCount,
		LastInvoiceRef:          record.LastInvoiceRef,
		LastPaymentAt:           optionalTimeString(record.LastPaymentAt),
		NextBillingAt:           optionalTimeString(record.NextBillingAt),
		SignupAt:                record.SignupAt.Format(time.RFC3339),
		RenewalAt:               optionalTimeString(record.RenewalAt),
		StoreLink:               record.StoreLink,
		DiscountCode:            record.DiscountCode,
		DiscountInstitution:     record.DiscountInstitution,
		LastActiveAt:            record.LastActiveAt.Format(time.RFC3339),
		Orders:                  record.OrdersCount,
		GMVMinor:                record.GMVMinor,
		CommissionMinor:         record.CommissionMinor,
		UpdatedAt:               record.UpdatedAt.Format(time.RFC3339),
		Events:                  events,
		Invoices:                invoices,
	}
}

func newSubscriptionBillingSweepResponse(
	record ports.AdminSubscriptionBillingSweepRecord,
) subscriptionBillingSweepResponse {
	return subscriptionBillingSweepResponse{
		OverdueInvoicesFailed: record.OverdueInvoicesFailed,
		SubscriptionsCanceled: record.SubscriptionsCanceled,
		BusinessesTouched:     record.BusinessesTouched,
		RanAt:                 record.RanAt.Format(time.RFC3339),
	}
}

func newSubscriptionRecurringSweepResponse(
	record ports.AdminSubscriptionRecurringSweepRecord,
) subscriptionRecurringSweepResponse {
	return subscriptionRecurringSweepResponse{
		DueSubscriptions:             record.DueSubscriptions,
		ChargesAttempted:             record.ChargesAttempted,
		ChargesPaid:                  record.ChargesPaid,
		ChargesPending:               record.ChargesPending,
		ChargesFailed:                record.ChargesFailed,
		ChargesSkipped:               record.ChargesSkipped,
		SubscriptionsAwaitingCadence: record.SubscriptionsAwaitingCadence,
		RanAt:                        record.RanAt.Format(time.RFC3339),
	}
}

func newSubscriptionAuthorizationLinkResponse(
	result adminauthapp.SubscriptionAuthorizationLinkResult,
) subscriptionAuthorizationLinkResponse {
	return subscriptionAuthorizationLinkResponse{
		BusinessID:   result.BusinessID.String(),
		BusinessName: result.BusinessName,
		OwnerEmail:   result.OwnerEmail,
		RedirectURL:  result.RedirectURL,
		AccessCode:   result.AccessCode,
		Reference:    result.Reference,
	}
}
