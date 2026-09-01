package affiliateauthhttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/skip2/go-qrcode"
	affiliateauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/affiliateauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Service interface {
	Activate(
		context.Context,
		string,
		string,
		affiliateauthapp.ClientContext,
	) (affiliateauthapp.SessionResult, error)
	Login(
		context.Context,
		string,
		string,
		affiliateauthapp.ClientContext,
	) (affiliateauthapp.SessionResult, error)
	Refresh(
		context.Context,
		string,
		affiliateauthapp.ClientContext,
	) (affiliateauthapp.SessionResult, error)
	Logout(context.Context, string) error
	RequestRecovery(context.Context, string) error
	ResendActivation(context.Context, string) error
	ResetPassword(context.Context, string, string) error
	Me(context.Context, common.ID) (ports.AffiliateAccountRecord, error)
	Dashboard(
		context.Context,
		common.ID,
		*time.Time,
		*time.Time,
	) (affiliateauthapp.DashboardResult, error)
	Conversions(
		context.Context,
		common.ID,
		string,
		string,
		string,
	) (affiliateauthapp.ConversionPage, error)
	Payouts(
		context.Context,
		common.ID,
		string,
	) (affiliateauthapp.PayoutPage, error)
	Referrals(context.Context, common.ID) ([]ports.PartnerReferralRecord, error)
	ShareLinks(context.Context, common.ID) (string, string, int, error)
	CampaignLinks(context.Context, common.ID) ([]ports.AffiliateCampaignLinkRecord, error)
	CreateCampaignLink(context.Context, common.ID, common.ID, string, string, string) (ports.AffiliateCampaignLinkRecord, error)
	PayoutProfile(context.Context, common.ID) (ports.AffiliatePayoutProfileRecord, error)
	UpdatePayoutProfile(context.Context, common.ID, string, string, string, string) (ports.AffiliatePayoutProfileRecord, error)
	NotificationPreferences(context.Context, common.ID) (ports.AffiliateNotificationPreferencesRecord, error)
	UpdateNotificationPreferences(context.Context, ports.AffiliateNotificationPreferencesRecord) (ports.AffiliateNotificationPreferencesRecord, error)
	ConversionCSV(context.Context, common.ID, time.Time, time.Time) ([]byte, error)
}

type Handler struct {
	service  Service
	verifier ports.AffiliateTokenVerifier
}

func NewHandler(service Service, verifier ports.AffiliateTokenVerifier) Handler {
	return Handler{service: service, verifier: verifier}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/affiliate/auth/activate", handler.activate)
	router.Post("/affiliate/auth/login", handler.login)
	router.Post("/affiliate/auth/refresh", handler.refresh)
	router.Post("/affiliate/auth/logout", handler.logout)
	router.Post("/affiliate/auth/recovery", handler.requestRecovery)
	router.Post("/affiliate/auth/activation/resend", handler.resendActivation)
	router.Post("/affiliate/auth/reset-password", handler.resetPassword)
	router.With(handler.authenticate).Get("/affiliate/me", handler.me)
	router.With(handler.authenticate).Get("/affiliate/dashboard", handler.dashboard)
	router.With(handler.authenticate).Get("/affiliate/conversions", handler.conversions)
	router.With(handler.authenticate).Get("/affiliate/payouts", handler.payouts)
	router.With(handler.authenticate).Get("/affiliate/referrals", handler.referrals)
	router.With(handler.authenticate).Get("/affiliate/share-links", handler.shareLinks)
	router.With(handler.authenticate).Get("/affiliate/share-links/qr.png", handler.shareLinkQR)
	router.With(handler.authenticate).Get("/affiliate/campaign-links", handler.campaignLinks)
	router.With(handler.authenticate).Post("/affiliate/campaign-links", handler.createCampaignLink)
	router.With(handler.authenticate).Get("/affiliate/payout-profile", handler.payoutProfile)
	router.With(handler.authenticate).Put("/affiliate/payout-profile", handler.updatePayoutProfile)
	router.With(handler.authenticate).Get("/affiliate/notification-preferences", handler.notificationPreferences)
	router.With(handler.authenticate).Put("/affiliate/notification-preferences", handler.updateNotificationPreferences)
	router.With(handler.authenticate).Get("/affiliate/reports/conversions.csv", handler.conversionCSV)
}

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type activationRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type tokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type recoveryRequest struct {
	Email string `json:"email"`
}

type campaignLinkRequest struct {
	Name           string `json:"name"`
	Slug           string `json:"slug"`
	DestinationURL string `json:"destination_url"`
}

type payoutProfileRequest struct {
	PayoutMethod      string `json:"payout_method"`
	AccountName       string `json:"account_name"`
	ProviderName      string `json:"provider_name"`
	AccountIdentifier string `json:"account_identifier"`
}

type notificationPreferencesRequest struct {
	ConversionEmails bool `json:"conversion_emails"`
	ApprovalEmails   bool `json:"approval_emails"`
	ReversalEmails   bool `json:"reversal_emails"`
	PayoutEmails     bool `json:"payout_emails"`
}

type accountResponse struct {
	AccountID   string `json:"account_id"`
	AffiliateID string `json:"affiliate_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Code        string `json:"code"`
	Status      string `json:"status"`
}

type sessionResponse struct {
	Account          accountResponse `json:"account"`
	AccessToken      string          `json:"access_token"`
	RefreshToken     string          `json:"refresh_token"`
	AccessExpiresAt  string          `json:"access_expires_at"`
	RefreshExpiresAt string          `json:"refresh_expires_at"`
}

type dashboardResponse struct {
	From                     string `json:"from"`
	To                       string `json:"to"`
	Clicks                   int64  `json:"clicks"`
	CustomerSignups          int64  `json:"customer_signups"`
	BusinessSignups          int64  `json:"business_signups"`
	PaidPlanSignups          int64  `json:"paid_plan_signups"`
	Purchases                int64  `json:"purchases"`
	GrossEligibleMinor       int64  `json:"gross_eligible_minor"`
	ClickToSignupRateBPS     int64  `json:"click_to_signup_rate_bps"`
	ClickToPurchaseRateBPS   int64  `json:"click_to_purchase_rate_bps"`
	PendingCommissionMinor   int64  `json:"pending_commission_minor"`
	AvailableCommissionMinor int64  `json:"available_commission_minor"`
	PaidCommissionMinor      int64  `json:"paid_commission_minor"`
	ReversedCommissionMinor  int64  `json:"reversed_commission_minor"`
	LifetimeEarningsMinor    int64  `json:"lifetime_earnings_minor"`
	ActiveReferrals          int64  `json:"active_referrals"`
	InactiveReferrals        int64  `json:"inactive_referrals"`
	NotActivatedReferrals    int64  `json:"not_activated_referrals"`
	NextMilestoneThreshold   int    `json:"next_milestone_threshold"`
	NextMilestoneTitle       string `json:"next_milestone_title"`
	PartnersInvited          int64  `json:"partners_invited"`
}

type conversionResponse struct {
	ConversionID    string `json:"conversion_id"`
	ConversionType  string `json:"conversion_type"`
	GrossMinor      int64  `json:"gross_minor"`
	CommissionMinor int64  `json:"commission_minor"`
	Status          string `json:"status"`
	OccurredAt      string `json:"occurred_at"`
}

type payoutResponse struct {
	PayoutID        string `json:"payout_id"`
	PayoutMode      string `json:"payout_mode"`
	PayoutReference string `json:"payout_reference"`
	ConversionCount int    `json:"conversion_count"`
	GrossMinor      int64  `json:"gross_minor"`
	CommissionMinor int64  `json:"commission_minor"`
	Status          string `json:"status"`
	CreatedAt       string `json:"created_at"`
}

func (handler Handler) activate(w http.ResponseWriter, r *http.Request) {
	var request activationRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.Activate(
		r.Context(),
		request.Token,
		request.Password,
		clientContext(r),
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, newSessionResponse(result))
}

func (handler Handler) login(w http.ResponseWriter, r *http.Request) {
	var request credentialsRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.Login(
		r.Context(),
		request.Email,
		request.Password,
		clientContext(r),
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, newSessionResponse(result))
}

func (handler Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var request tokenRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.Refresh(
		r.Context(),
		request.RefreshToken,
		clientContext(r),
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, newSessionResponse(result))
}

func (handler Handler) logout(w http.ResponseWriter, r *http.Request) {
	var request tokenRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.Logout(r.Context(), request.RefreshToken); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) requestRecovery(w http.ResponseWriter, r *http.Request) {
	var request recoveryRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.RequestRecovery(r.Context(), request.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (handler Handler) resendActivation(w http.ResponseWriter, r *http.Request) {
	var request recoveryRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.ResendActivation(r.Context(), request.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var request activationRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := handler.service.ResetPassword(
		r.Context(),
		request.Token,
		request.Password,
	); err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler Handler) me(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	account, err := handler.service.Me(r.Context(), principal.AccountID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, newAccountResponse(account))
}

func (handler Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	from, err := optionalTime(r.URL.Query().Get("from"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	to, err := optionalTime(r.URL.Query().Get("to"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	result, err := handler.service.Dashboard(
		r.Context(),
		principal.AffiliateID,
		from,
		to,
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, newDashboardResponse(result))
}

func (handler Handler) conversions(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.Conversions(
		r.Context(),
		principal.AffiliateID,
		r.URL.Query().Get("cursor"),
		r.URL.Query().Get("type"),
		r.URL.Query().Get("status"),
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	records := make([]conversionResponse, 0, len(result.Records))
	for _, record := range result.Records {
		records = append(records, newConversionResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"conversions": records,
		"next_cursor": result.NextCursor,
	})
}

func (handler Handler) payouts(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.Payouts(
		r.Context(),
		principal.AffiliateID,
		r.URL.Query().Get("cursor"),
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	records := make([]payoutResponse, 0, len(result.Records))
	for _, record := range result.Records {
		records = append(records, newPayoutResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"payouts":     records,
		"next_cursor": result.NextCursor,
	})
}

func (handler Handler) referrals(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	records, err := handler.service.Referrals(r.Context(), principal.AffiliateID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"referrals": records})
}

func (handler Handler) shareLinks(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	code, canonicalURL, cookieWindowDays, err := handler.service.ShareLinks(
		r.Context(),
		principal.AccountID,
	)
	if err != nil {
		status, errorCode := authError(err)
		writeError(w, status, errorCode)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"code":               code,
		"canonical_url":      canonicalURL,
		"cookie_window_days": cookieWindowDays,
	})
}

func (handler Handler) shareLinkQR(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	_, canonicalURL, _, err := handler.service.ShareLinks(r.Context(), principal.AccountID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	png, err := qrcode.Encode(canonicalURL, qrcode.Medium, 768)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Disposition", `attachment; filename="xtiitch-affiliate-qr.png"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(png)
}

func (handler Handler) campaignLinks(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	records, err := handler.service.CampaignLinks(r.Context(), principal.AffiliateID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"campaign_links": records})
}

func (handler Handler) createCampaignLink(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request campaignLinkRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	record, err := handler.service.CreateCampaignLink(r.Context(),
		principal.AccountID, principal.AffiliateID, request.Name,
		request.Slug, request.DestinationURL)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusCreated, record)
}

func (handler Handler) payoutProfile(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	record, err := handler.service.PayoutProfile(r.Context(), principal.AffiliateID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (handler Handler) updatePayoutProfile(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request payoutProfileRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	record, err := handler.service.UpdatePayoutProfile(r.Context(),
		principal.AffiliateID, request.PayoutMethod, request.AccountName,
		request.ProviderName, request.AccountIdentifier)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (handler Handler) notificationPreferences(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	record, err := handler.service.NotificationPreferences(r.Context(), principal.AffiliateID)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (handler Handler) updateNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	var request notificationPreferencesRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	record, err := handler.service.UpdateNotificationPreferences(r.Context(),
		ports.AffiliateNotificationPreferencesRecord{
			AffiliateID:      principal.AffiliateID,
			ConversionEmails: request.ConversionEmails,
			ApprovalEmails:   request.ApprovalEmails,
			ReversalEmails:   request.ReversalEmails,
			PayoutEmails:     request.PayoutEmails,
		})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (handler Handler) conversionCSV(w http.ResponseWriter, r *http.Request) {
	principal, ok := principalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	to := time.Now().UTC()
	from := to.AddDate(0, -1, 0)
	if value, err := optionalTime(r.URL.Query().Get("from")); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	} else if value != nil {
		from = *value
	}
	if value, err := optionalTime(r.URL.Query().Get("to")); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	} else if value != nil {
		to = *value
	}
	content, err := handler.service.ConversionCSV(r.Context(),
		principal.AffiliateID, from, to)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="affiliate-conversions.csv"`)
	// Without nosniff a browser may ignore the declared text/csv and sniff the
	// bytes as HTML, which is the only way the response below could ever be
	// rendered rather than downloaded.
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	// gosec G705 flags this as XSS-via-taint because `content` derives from a
	// request. It is not reachable: the response is served as text/csv with
	// Content-Disposition: attachment and nosniff, so no browser renders it;
	// and every cell ConversionCSV writes is machine-generated — an RFC3339
	// timestamp, a status/type enum, or a strconv integer. There is no
	// free-text column, so CSV formula injection has no way in either.
	//nolint:gosec // G705 false positive: attachment + nosniff, no free-text cells
	_, _ = w.Write(content)
}

type principal struct {
	AccountID   common.ID
	AffiliateID common.ID
}

type principalKey struct{}

func (handler Handler) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if len(header) < 8 || !strings.EqualFold(header[:7], "Bearer ") {
			writeError(w, http.StatusUnauthorized, "missing_token")
			return
		}
		verified, err := handler.verifier.VerifyAffiliateAccessToken(
			r.Context(),
			strings.TrimSpace(header[7:]),
		)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid_token")
			return
		}
		value := principal{
			AccountID:   verified.AccountID,
			AffiliateID: verified.AffiliateID,
		}
		ctx := context.WithValue(r.Context(), principalKey{}, value)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func principalFromContext(ctx context.Context) (principal, bool) {
	value, ok := ctx.Value(principalKey{}).(principal)
	return value, ok
}

func clientContext(r *http.Request) affiliateauthapp.ClientContext {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return affiliateauthapp.ClientContext{
		UserAgent: r.UserAgent(),
		IPAddress: host,
	}
}

func authError(err error) (int, string) {
	switch {
	case errors.Is(err, affiliateauthapp.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_request"
	case errors.Is(err, affiliateauthapp.ErrInvalidActivation):
		return http.StatusUnauthorized, "invalid_activation_token"
	case errors.Is(err, affiliateauthapp.ErrInvalidRecovery):
		return http.StatusUnauthorized, "invalid_recovery_token"
	case errors.Is(err, affiliateauthapp.ErrInvalidCredentials):
		return http.StatusUnauthorized, "invalid_credentials"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func newSessionResponse(result affiliateauthapp.SessionResult) sessionResponse {
	return sessionResponse{
		Account:          newAccountResponse(result.Account),
		AccessToken:      result.AccessToken,
		RefreshToken:     result.RefreshToken,
		AccessExpiresAt:  result.AccessExpiresAt.Format(time.RFC3339),
		RefreshExpiresAt: result.RefreshExpiresAt.Format(time.RFC3339),
	}
}

func newAccountResponse(account ports.AffiliateAccountRecord) accountResponse {
	return accountResponse{
		AccountID:   account.AccountID.String(),
		AffiliateID: account.AffiliateID.String(),
		Email:       account.Email,
		DisplayName: account.DisplayName,
		Code:        account.Code,
		Status:      account.Status,
	}
}

func newDashboardResponse(result affiliateauthapp.DashboardResult) dashboardResponse {
	record := result.Record
	return dashboardResponse{
		From:                     result.From.Format(time.RFC3339),
		To:                       result.To.Format(time.RFC3339),
		Clicks:                   record.ClickCount,
		CustomerSignups:          record.CustomerSignupCount,
		BusinessSignups:          record.BusinessSignupCount,
		PaidPlanSignups:          record.PaidPlanSignupCount,
		Purchases:                record.PurchaseCount,
		GrossEligibleMinor:       record.GrossEligibleMinor,
		ClickToSignupRateBPS:     result.ClickToSignupRateBPS,
		ClickToPurchaseRateBPS:   result.ClickToPurchaseRateBPS,
		PendingCommissionMinor:   record.PendingCommissionMinor,
		AvailableCommissionMinor: record.AvailableCommissionMinor,
		PaidCommissionMinor:      record.PaidCommissionMinor,
		ReversedCommissionMinor:  record.ReversedCommissionMinor,
		LifetimeEarningsMinor:    record.LifetimeEarningsMinor,
		ActiveReferrals:          record.ActiveReferralCount,
		InactiveReferrals:        record.InactiveReferralCount,
		NotActivatedReferrals:    record.NotActivatedCount,
		NextMilestoneThreshold:   record.NextMilestoneThreshold,
		NextMilestoneTitle:       record.NextMilestoneTitle,
		PartnersInvited:          record.PartnersInvitedCount,
	}
}

func newConversionResponse(record ports.AffiliateConversionRecord) conversionResponse {
	return conversionResponse{
		ConversionID:    record.ConversionID.String(),
		ConversionType:  record.ConversionType,
		GrossMinor:      record.GrossMinor,
		CommissionMinor: record.CommissionMinor,
		Status:          record.Status,
		OccurredAt:      record.OccurredAt.Format(time.RFC3339),
	}
}

func newPayoutResponse(record ports.AffiliatePayoutRecord) payoutResponse {
	return payoutResponse{
		PayoutID:        record.PayoutID.String(),
		PayoutMode:      record.PayoutMode,
		PayoutReference: record.PayoutReference,
		ConversionCount: record.ConversionCount,
		GrossMinor:      record.GrossMinor,
		CommissionMinor: record.CommissionMinor,
		Status:          record.Status,
		CreatedAt:       record.CreatedAt.Format(time.RFC3339),
	}
}

func optionalTime(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		parsed, err = time.Parse(time.DateOnly, value)
		if err != nil {
			return nil, err
		}
	}
	return &parsed, nil
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
