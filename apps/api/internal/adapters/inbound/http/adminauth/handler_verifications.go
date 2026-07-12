package adminauthhttp

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type businessVerificationDecisionRequest struct {
	Decision string `json:"decision"`
	Note     string `json:"note"`
}

type businessVerificationResponse struct {
	BusinessID     string   `json:"business_id"`
	BusinessName   string   `json:"business_name"`
	Handle         string   `json:"handle"`
	OwnerName      string   `json:"owner_name"`
	OwnerEmail     string   `json:"owner_email"`
	SubmittedAt    string   `json:"submitted_at"`
	UpdatedAt      string   `json:"updated_at"`
	Plan           string   `json:"plan"`
	Status         string   `json:"status"`
	RiskLevel      string   `json:"risk_level"`
	Documents      []string `json:"documents"`
	Checks         []string `json:"checks"`
	Evidence       []string `json:"evidence"`
	Notes          string   `json:"notes"`
	IDCardNumber   string   `json:"id_card_number"`
	IDPhotoURL     string   `json:"id_photo_url"`
	IDPhotoBackURL string   `json:"id_photo_back_url"`
}

func (handler Handler) businessVerifications(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListBusinessVerifications(r.Context(), adminauthapp.ListBusinessVerificationsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]businessVerificationResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newBusinessVerificationResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]businessVerificationResponse{"cases": out})
}

func (handler Handler) decideBusinessVerification(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request businessVerificationDecisionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.DecideBusinessVerification(r.Context(), adminauthapp.DecideBusinessVerificationCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		BusinessID:  common.ID(chi.URLParam(r, "id")),
		Decision:    adminauthapp.BusinessVerificationDecision(request.Decision),
		Note:        request.Note,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newBusinessVerificationResponse(record))
}

func newBusinessVerificationResponse(record ports.AdminVerificationCaseRecord) businessVerificationResponse {
	return businessVerificationResponse{
		BusinessID:     record.BusinessID.String(),
		BusinessName:   record.BusinessName,
		Handle:         record.Handle,
		OwnerName:      fallbackText(record.OwnerName, "Owner pending"),
		OwnerEmail:     fallbackText(record.OwnerEmail, "owner email pending"),
		SubmittedAt:    record.SubmittedAt.Format(time.RFC3339),
		UpdatedAt:      record.UpdatedAt.Format(time.RFC3339),
		Plan:           fallbackText(record.PlanName, record.PlanCode),
		Status:         string(record.VerificationStatus),
		RiskLevel:      verificationRiskLevel(record),
		Documents:      verificationDocuments(record),
		Checks:         verificationChecks(record),
		Evidence:       verificationEvidence(record),
		Notes:          verificationNotes(record),
		IDCardNumber:   record.IDCardNumber,
		IDPhotoURL:     record.IDPhotoURL,
		IDPhotoBackURL: record.IDPhotoBackURL,
	}
}

func verificationRiskLevel(record ports.AdminVerificationCaseRecord) string {
	if string(record.VerificationStatus) == "rejected" {
		return "high"
	}
	if strings.TrimSpace(record.SettlementSubaccount) == "" && strings.TrimSpace(record.SettlementAccountHint) == "" {
		return "medium"
	}
	return "low"
}

func verificationDocuments(record ports.AdminVerificationCaseRecord) []string {
	documents := []string{"Business profile", "Owner account"}
	if strings.TrimSpace(record.SettlementSubaccount) != "" || strings.TrimSpace(record.SettlementAccountHint) != "" {
		documents = append(documents, "Settlement account")
	}
	if strings.TrimSpace(record.PlanCode) != "" {
		documents = append(documents, "Plan record")
	}
	return documents
}

func verificationChecks(record ports.AdminVerificationCaseRecord) []string {
	checks := []string{
		"Store handle reserved",
		"Owner account attached",
		"Plan is active",
	}
	if strings.TrimSpace(record.SettlementSubaccount) != "" {
		checks = append(checks, "Payment subaccount connected")
	} else {
		checks = append(checks, "Payment subaccount pending")
	}
	return checks
}

func verificationEvidence(record ports.AdminVerificationCaseRecord) []string {
	evidence := []string{
		"Store handle: " + record.Handle,
		"Owner: " + fallbackText(record.OwnerEmail, "owner email pending"),
		"Plan: " + fallbackText(record.PlanName, record.PlanCode),
	}
	if strings.TrimSpace(record.SettlementSubaccount) != "" {
		evidence = append(evidence, "Provider subaccount: "+record.SettlementSubaccount)
	}
	if strings.TrimSpace(record.SettlementAccountHint) != "" {
		evidence = append(evidence, "Settlement account "+maskedAccountHint(record.SettlementAccountHint))
	}
	return evidence
}

func verificationNotes(record ports.AdminVerificationCaseRecord) string {
	switch string(record.VerificationStatus) {
	case "verified":
		return "Business verification is approved. Payments and deposit flows can stay enabled."
	case "rejected":
		return "Business verification was rejected. Reopen only after owner and settlement evidence are corrected."
	}
	if strings.TrimSpace(record.SettlementSubaccount) == "" && strings.TrimSpace(record.SettlementAccountHint) == "" {
		return "Settlement details are not connected yet. Hold before enabling payment rails."
	}
	return "Review the owner account, handle, plan, and settlement evidence before enabling money rails."
}
