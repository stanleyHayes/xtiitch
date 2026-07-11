package adminauth

import (
	"context"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type GetMoneyRailsCommand struct {
	ActorRole admindomain.Role
}

type QueueMoneyReplayCommand struct {
	ActorUserID       common.ID
	ActorRole         admindomain.Role
	ProviderReference string
	Reason            string
	UserAgent         string
	IPAddress         string
}

type ReverseMoneyPaymentCommand struct {
	ActorUserID       common.ID
	ActorRole         admindomain.Role
	ProviderReference string
	Reason            string
	UserAgent         string
	IPAddress         string
}

type SetSettlementReviewHoldCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	BusinessID  common.ID
	Hold        bool
	Reason      string
	UserAgent   string
	IPAddress   string
}

func (s Service) GetMoneyRails(ctx context.Context, cmd GetMoneyRailsCommand) (ports.AdminMoneyRailsRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminMoneyRailsRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminMoneyRailsRecord{}, authdomain.ErrForbidden
	}

	return s.businesses.GetAdminMoneyRails(ctx)
}

func (s Service) QueueMoneyReplay(
	ctx context.Context,
	cmd QueueMoneyReplayCommand,
) (ports.AdminMoneyReplayRequestRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminMoneyReplayRequestRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminMoneyReplayRequestRecord{}, authdomain.ErrForbidden
	}

	providerReference := strings.TrimSpace(cmd.ProviderReference)
	if providerReference == "" {
		return ports.AdminMoneyReplayRequestRecord{}, authdomain.ErrInvalidInput
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator queued provider event for money-rails review."
	}

	record, err := s.businesses.QueueAdminMoneyReplay(ctx, ports.QueueAdminMoneyReplayInput{
		ReplayRequestID:   s.ids.NewID(),
		ProviderReference: providerReference,
		RequestedByUserID: cmd.ActorUserID,
		Reason:            reason,
	})
	if err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Queued money replay",
		TargetType:  "payment_provider_reference",
		TargetID:    record.ProviderReference,
		TargetLabel: fallbackString(record.BusinessName, record.ProviderReference),
		Summary:     "Operator queued a payment provider reference for money-rails replay review.",
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"provider_reference": record.ProviderReference,
			"payment_id":         record.PaymentID.String(),
			"reason":             reason,
			"status":             record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminMoneyReplayRequestRecord{}, err
	}

	return record, nil
}

func (s Service) ReverseMoneyPayment(
	ctx context.Context,
	cmd ReverseMoneyPaymentCommand,
) (ports.AdminMoneyReversalRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminMoneyReversalRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminMoneyReversalRecord{}, authdomain.ErrForbidden
	}

	providerReference := strings.TrimSpace(cmd.ProviderReference)
	if providerReference == "" {
		return ports.AdminMoneyReversalRecord{}, authdomain.ErrInvalidInput
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator reversed payment after refund or dispute confirmation."
	}

	record, err := s.businesses.ReverseAdminMoneyPayment(ctx, ports.ReverseAdminMoneyPaymentInput{
		ProviderReference: providerReference,
		ActorAdminUser:    cmd.ActorUserID,
		Reason:            reason,
	})
	if err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Reversed payment impact",
		TargetType:  "payment",
		TargetID:    record.PaymentID.String(),
		TargetLabel: record.ProviderReference,
		Summary: "Reversed payment " + record.ProviderReference +
			" and voided related growth ledgers.",
		Severity: admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"provider_reference":    record.ProviderReference,
			"business_id":           record.BusinessID.String(),
			"payment_reversed":      boolString(record.PaymentReversed),
			"promotion_redemptions": intString(record.PromotionRedemptionCount),
			"affiliate_conversions": intString(record.AffiliateConversionCount),
			"referrals":             intString(record.ReferralCount),
			"referral_rewards":      intString(record.ReferralRewardCount),
			"generated_promotions":  intString(record.GeneratedPromotionCount),
			"reason":                record.Reason,
			"reversed_at":           record.ReversedAt.Format(time.RFC3339),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminMoneyReversalRecord{}, err
	}

	return record, nil
}

func (s Service) SetSettlementReviewHold(
	ctx context.Context,
	cmd SetSettlementReviewHoldCommand,
) (ports.AdminMoneyPayoutReviewRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.BusinessID.IsZero() {
		return ports.AdminMoneyPayoutReviewRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageMoneyRails); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminMoneyPayoutReviewRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		if cmd.Hold {
			reason = "Operator placed settlement review hold."
		} else {
			reason = "Operator released settlement review hold."
		}
	}

	record, err := s.businesses.SetAdminSettlementReviewHold(ctx, ports.SetAdminSettlementReviewHoldInput{
		BusinessID:     cmd.BusinessID,
		Hold:           cmd.Hold,
		Reason:         reason,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	action := "Released settlement review hold"
	severity := admindomain.AuditSeverityInfo
	if cmd.Hold {
		action = "Placed settlement review hold"
		severity = admindomain.AuditSeverityCritical
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "business",
		TargetID:    record.ID,
		TargetLabel: record.BusinessName,
		Summary:     action + ". Reason: " + reason,
		Severity:    severity,
		Metadata: map[string]string{
			"hold_active":      boolString(record.HoldActive),
			"settlement_minor": intString64(record.SettlementMinor),
			"commission_minor": intString64(record.CommissionMinor),
			"reason":           reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminMoneyPayoutReviewRecord{}, err
	}

	return record, nil
}
