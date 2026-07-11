package adminauthhttp

import (
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (handler Handler) referralProgrammes(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListReferralProgrammes(r.Context(), adminauthapp.ListReferralProgrammesCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]referralProgrammeResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newReferralProgrammeResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]referralProgrammeResponse{"programmes": out})
}

func (handler Handler) createReferralProgramme(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralProgrammeUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateReferralProgramme(r.Context(), adminauthapp.CreateReferralProgrammeCommand{
		ActorUserID:             principal.AdminUserID,
		ActorRole:               principal.Role,
		Title:                   request.Title,
		CodePrefix:              request.CodePrefix,
		Audience:                request.Audience,
		ReferrerRewardKind:      request.ReferrerRewardKind,
		RefereeRewardKind:       request.RefereeRewardKind,
		RewardType:              request.RewardType,
		RewardValue:             request.RewardValue,
		MaxRewardMinor:          request.MaxRewardMinor,
		QualifyingOrderMinMinor: request.QualifyingOrderMinMinor,
		RewardHoldDays:          request.RewardHoldDays,
		Status:                  request.Status,
		StartsAt:                request.StartsAt,
		EndsAt:                  request.EndsAt,
		Notes:                   request.Notes,
		UserAgent:               r.UserAgent(),
		IPAddress:               requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newReferralProgrammeResponse(record))
}

func (handler Handler) updateReferralProgramme(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralProgrammeUpsertRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.UpdateReferralProgramme(r.Context(), adminauthapp.UpdateReferralProgrammeCommand{
		ActorUserID:             principal.AdminUserID,
		ActorRole:               principal.Role,
		ProgrammeID:             common.ID(chi.URLParam(r, "id")),
		Title:                   request.Title,
		CodePrefix:              request.CodePrefix,
		Audience:                request.Audience,
		ReferrerRewardKind:      request.ReferrerRewardKind,
		RefereeRewardKind:       request.RefereeRewardKind,
		RewardType:              request.RewardType,
		RewardValue:             request.RewardValue,
		MaxRewardMinor:          request.MaxRewardMinor,
		QualifyingOrderMinMinor: request.QualifyingOrderMinMinor,
		RewardHoldDays:          request.RewardHoldDays,
		Status:                  request.Status,
		StartsAt:                request.StartsAt,
		EndsAt:                  request.EndsAt,
		Notes:                   request.Notes,
		UserAgent:               r.UserAgent(),
		IPAddress:               requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newReferralProgrammeResponse(record))
}

func (handler Handler) createReferralCode(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralCodeCreateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.CreateReferralCode(r.Context(), adminauthapp.CreateReferralCodeCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		ProgrammeID: common.ID(chi.URLParam(r, "id")),
		BusinessID:  optionalCommonID(request.BusinessID),
		OwnerType:   request.OwnerType,
		Code:        request.Code,
		Status:      request.Status,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newReferralCodeResponse(record))
}

func (handler Handler) archiveReferralProgramme(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralProgrammeArchiveRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.ArchiveReferralProgramme(r.Context(), adminauthapp.ArchiveReferralProgrammeCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		ProgrammeID: common.ID(chi.URLParam(r, "id")),
		Reason:      request.Reason,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newReferralProgrammeResponse(record))
}

func (handler Handler) issueReferralRewards(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request referralRewardIssueRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	record, err := handler.service.IssueReferralRewards(r.Context(), adminauthapp.IssueReferralRewardsCommand{
		ActorUserID: principal.AdminUserID,
		ActorRole:   principal.Role,
		Limit:       request.Limit,
		UserAgent:   r.UserAgent(),
		IPAddress:   requestIP(r),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusCreated, newReferralRewardIssueResponse(record))
}

func (handler Handler) supportTickets(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListSupportTickets(r.Context(), adminauthapp.ListSupportTicketsCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]supportTicketResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newSupportTicketResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]supportTicketResponse{"tickets": out})
}

func (handler Handler) updateSupportTicket(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request supportTicketUpdateRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}

	ticketKey, err := url.PathUnescape(chi.URLParam(r, "key"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_input")
		return
	}

	record, err := handler.service.UpdateSupportTicket(
		r.Context(),
		adminauthapp.UpdateSupportTicketCommand{
			ActorUserID: principal.AdminUserID,
			ActorRole:   principal.Role,
			TicketKey:   ticketKey,
			Status:      request.Status,
			Assignment:  request.Assignment,
			Note:        request.Note,
			UserAgent:   r.UserAgent(),
			IPAddress:   requestIP(r),
		},
	)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newSupportTicketResponse(record))
}

func newReferralProgrammeResponse(record ports.AdminReferralProgrammeRecord) referralProgrammeResponse {
	response := referralProgrammeResponse{
		ProgrammeID:             record.ProgrammeID.String(),
		Title:                   record.Title,
		CodePrefix:              record.CodePrefix,
		Audience:                record.Audience,
		ReferrerRewardKind:      record.ReferrerRewardKind,
		RefereeRewardKind:       record.RefereeRewardKind,
		RewardType:              record.RewardType,
		RewardValue:             record.RewardValue,
		MaxRewardMinor:          record.MaxRewardMinor,
		QualifyingOrderMinMinor: record.QualifyingOrderMinMinor,
		RewardHoldDays:          record.RewardHoldDays,
		Status:                  record.Status,
		Notes:                   record.Notes,
		CreatedAt:               record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:               record.UpdatedAt.Format(time.RFC3339),
	}
	if record.StartsAt != nil {
		response.StartsAt = record.StartsAt.Format(time.RFC3339)
	}
	if record.EndsAt != nil {
		response.EndsAt = record.EndsAt.Format(time.RFC3339)
	}
	for _, code := range record.RecentCodes {
		response.Codes = append(response.Codes, newReferralCodeResponse(code))
	}
	return response
}

func newReferralCodeResponse(record ports.AdminReferralCodeRecord) referralCodeResponse {
	response := referralCodeResponse{
		ReferralCodeID: record.ReferralCodeID.String(),
		ProgrammeID:    record.ProgrammeID.String(),
		BusinessName:   record.BusinessName,
		BusinessHandle: record.BusinessHandle,
		OwnerType:      record.OwnerType,
		OwnerLabel:     record.OwnerLabel,
		Code:           record.Code,
		Status:         record.Status,
		ReferralCount:  record.ReferralCount,
		QualifiedCount: record.QualifiedCount,
		RewardedCount:  record.RewardedCount,
		CreatedAt:      record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      record.UpdatedAt.Format(time.RFC3339),
	}
	if record.BusinessID != nil {
		response.BusinessID = record.BusinessID.String()
	}
	if record.OwnerBusinessID != nil {
		response.OwnerBusinessID = record.OwnerBusinessID.String()
	}
	if record.OwnerCustomerID != nil {
		response.OwnerCustomerID = record.OwnerCustomerID.String()
	}
	return response
}

func newReferralRewardIssueResponse(record ports.AdminReferralRewardIssueRecord) referralRewardIssueResponse {
	return referralRewardIssueResponse{
		ReferralCount:         record.ReferralCount,
		RewardCount:           record.RewardCount,
		VoucherCount:          record.VoucherCount,
		CommissionRebateCount: record.CommissionRebateCount,
		TotalRewardMinor:      record.TotalRewardMinor,
		IssuedAt:              record.IssuedAt.Format(time.RFC3339),
	}
}

func newSupportTicketResponse(record ports.AdminSupportTicketRecord) supportTicketResponse {
	return supportTicketResponse{
		TicketKey:           record.TicketKey,
		BusinessID:          record.BusinessID.String(),
		Subject:             record.Subject,
		Business:            record.BusinessName,
		Priority:            record.Priority,
		Summary:             record.Summary,
		Category:            record.Category,
		Status:              record.Status,
		AssignedAdminUserID: record.AssignedAdminUserID.String(),
		AssignedAdminEmail:  record.AssignedAdminEmail,
		AssignedAdminName:   record.AssignedAdminName,
		CreatedAt:           record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           record.UpdatedAt.Format(time.RFC3339),
	}
}

func optionalTimeString(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format(time.RFC3339)
}

func optionalIDString(value *common.ID) string {
	if value == nil {
		return ""
	}
	return value.String()
}
