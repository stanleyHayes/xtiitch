package adminauthhttp

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// payouts is the §11.5 payouts CRM: one row per store, searchable by business
// name, handle or owner legal name (query param "query"), paged with
// limit/offset. Every figure comes from persisted Paystack-derived records —
// Paystack is the source of truth (§3.2).
func (handler Handler) payouts(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListPayouts(r.Context(), adminauthapp.ListPayoutsCommand{
		ActorRole: principal.Role,
		Query:     r.URL.Query().Get("query"),
		Limit:     parsePayoutQueryLimit(r.URL.Query().Get("limit")),
		Offset:    parsePayoutQueryOffset(r.URL.Query().Get("offset")),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]payoutRowResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newPayoutRowResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]payoutRowResponse{"payouts": out})
}

// payoutHistory is the §11.5 "Payout history" drill-down: one store's mirrored
// settlement rows (amount, date, status), paged with limit/offset.
func (handler Handler) payoutHistory(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.GetPayoutHistory(r.Context(), adminauthapp.GetPayoutHistoryCommand{
		ActorRole:  principal.Role,
		BusinessID: common.ID(chi.URLParam(r, "id")),
		Limit:      parsePayoutQueryLimit(r.URL.Query().Get("limit")),
		Offset:     parsePayoutQueryOffset(r.URL.Query().Get("offset")),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]payoutHistoryRowResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newPayoutHistoryRowResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]payoutHistoryRowResponse{"payouts": out})
}

// settlementSync triggers a forced settlement sync from Paystack (§3.3) — one
// store when the body names a business_id, otherwise every store with a
// subaccount on file (the worker/ops cadence). Audited in the service.
func (handler Handler) settlementSync(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	// An empty body means "sync every store with a subaccount"; a JSON body may
	// narrow the run to one business_id.
	var request settlementSyncRequest
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}
	if len(bytes.TrimSpace(body)) > 0 {
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&request); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
	}

	record, err := handler.service.RunSettlementSync(r.Context(), adminauthapp.RunSettlementSyncCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		BusinessID:  optionalCommonID(request.BusinessID),
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, settlementSyncResponse{
		Synced:   record.Synced,
		Skipped:  record.Skipped,
		Failed:   record.Failed,
		Upserted: record.Upserted,
	})
}

func newPayoutRowResponse(record ports.AdminPayoutRecord) payoutRowResponse {
	lastPayoutAt := ""
	if record.LastPayoutAt != nil {
		lastPayoutAt = record.LastPayoutAt.Format(time.RFC3339)
	}
	return payoutRowResponse{
		BusinessID:        record.BusinessID.String(),
		BusinessName:      record.BusinessName,
		Handle:            record.Handle,
		OwnerLegalName:    record.OwnerLegalName,
		MomoNetwork:       record.MomoNetwork,
		MomoNumber:        record.MomoNumber,
		MomoAccountName:   record.MomoAccountName,
		SubaccountCode:    record.SubaccountRef,
		TotalSalesMinor:   record.TotalSalesMinor,
		TotalSettledMinor: record.TotalSettledMinor,
		XtiitchFeesMinor:  record.XtiitchFeesMinor,
		XtiitchTaxMinor:   record.XtiitchTaxMinor,
		AmountDueMinor:    record.AmountDueMinor,
		LastPayoutAt:      lastPayoutAt,
		LastPayoutStatus:  record.LastPayoutStatus,
	}
}

func newPayoutHistoryRowResponse(record ports.AdminPayoutHistoryRecord) payoutHistoryRowResponse {
	settledAt := ""
	if record.SettledAt != nil {
		settledAt = record.SettledAt.Format(time.RFC3339)
	}
	return payoutHistoryRowResponse{
		SettlementID: record.SettlementID.String(),
		Reference:    record.ProviderReference,
		AmountMinor:  record.AmountMinor,
		Status:       record.Status,
		SettledAt:    settledAt,
		CreatedAt:    record.CreatedAt.Format(time.RFC3339),
	}
}

// 0/blank/absurd paging params fall back to the defaults, mirroring the service
// clamps — the handler parses, the service still enforces.
func parsePayoutQueryLimit(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0
	}
	return parsed
}

func parsePayoutQueryOffset(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}
