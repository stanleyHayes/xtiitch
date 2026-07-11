package adminauth

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BusinessVerificationDecision string

const (
	BusinessVerificationDecisionApproved BusinessVerificationDecision = "approved"
	BusinessVerificationDecisionRejected BusinessVerificationDecision = "rejected"
	BusinessVerificationDecisionHeld     BusinessVerificationDecision = "held"
)

type ListBusinessVerificationsCommand struct {
	ActorRole admindomain.Role
}

type ListRiskReviewsCommand struct {
	ActorRole admindomain.Role
}

type SetRiskReviewStatusCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	ReviewKey   string
	Status      string
	Reason      string
	UserAgent   string
	IPAddress   string
}

type DecideBusinessVerificationCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	Decision    BusinessVerificationDecision
	Note        string
	UserAgent   string
	IPAddress   string
}

func (s Service) ListBusinessVerifications(
	ctx context.Context,
	cmd ListBusinessVerificationsCommand,
) ([]ports.AdminVerificationCaseRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminVerificationCases(ctx)
}

func (s Service) DecideBusinessVerification(
	ctx context.Context,
	cmd DecideBusinessVerificationCommand,
) (ports.AdminVerificationCaseRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminVerificationCaseRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminVerificationCaseRecord{}, authdomain.ErrForbidden
	}

	status, err := statusForBusinessVerificationDecision(cmd.Decision)
	if err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	record, err := s.businesses.DecideAdminBusinessVerification(
		ctx,
		ports.AdminBusinessVerificationDecisionInput{
			BusinessID: cmd.BusinessID,
			Status:     status,
		},
	)
	if err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	note := normalizeOperatorNote(cmd.Note)
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      verificationDecisionAction(cmd.Decision),
		TargetType:  "business",
		TargetID:    record.BusinessID.String(),
		TargetLabel: record.BusinessName,
		Summary:     verificationDecisionSummary(cmd.Decision, note),
		Severity:    verificationDecisionSeverity(cmd.Decision),
		Metadata: map[string]string{
			"decision":            string(cmd.Decision),
			"verification_status": string(record.VerificationStatus),
			"handle":              record.Handle,
			"operator_note":       note,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	return record, nil
}

func (s Service) ListRiskReviews(ctx context.Context, cmd ListRiskReviewsCommand) ([]ports.AdminRiskReviewRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRisk); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminRiskReviews(ctx)
}

func (s Service) SetRiskReviewStatus(
	ctx context.Context,
	cmd SetRiskReviewStatusCommand,
) (ports.AdminRiskReviewRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageRisk); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrForbidden
	}

	reviewKey := strings.TrimSpace(cmd.ReviewKey)
	if reviewKey == "" {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrInvalidInput
	}

	status := strings.TrimSpace(cmd.Status)
	if status != "open" && status != "closed" {
		return ports.AdminRiskReviewRecord{}, authdomain.ErrInvalidInput
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		if status == "closed" {
			reason = "Operator closed risk review."
		} else {
			reason = "Operator reopened risk review."
		}
	}

	record, err := s.businesses.SetAdminRiskReviewStatus(ctx, ports.SetAdminRiskReviewStatusInput{
		ReviewKey:      reviewKey,
		Status:         status,
		Reason:         reason,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	action := "Reopened risk review"
	severity := admindomain.AuditSeverityWarning
	if status == "closed" {
		action = "Closed risk review"
		severity = admindomain.AuditSeverityInfo
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "risk_review",
		TargetID:    record.ReviewKey,
		TargetLabel: fallbackString(record.BusinessName, record.Title),
		Summary:     action + ". Reason: " + reason,
		Severity:    severity,
		Metadata: map[string]string{
			"business_id": record.BusinessID.String(),
			"level":       record.Level,
			"reason":      reason,
			"status":      record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminRiskReviewRecord{}, err
	}

	return record, nil
}
