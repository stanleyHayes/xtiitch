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

type RunAffiliatePayoutSweepCommand struct {
	ActorUserID                  common.ID
	ActorRole                    admindomain.Role
	Reason, UserAgent, IPAddress string
}
type AffiliatePayoutSweepResult struct {
	Claimed, Initiated, Settled, Pending, Failed int
	RanAt                                        time.Time
}

func (s Service) RunAffiliatePayoutSweep(ctx context.Context, cmd RunAffiliatePayoutSweepCommand) (AffiliatePayoutSweepResult, error) {
	if cmd.ActorUserID.IsZero() || !cmd.ActorRole.Valid() {
		return AffiliatePayoutSweepResult{}, authdomain.ErrInvalidInput
	}
	if cmd.ActorRole != admindomain.RoleOwner {
		return AffiliatePayoutSweepResult{}, authdomain.ErrForbidden
	}
	if s.affiliatePayouts == nil || s.affiliatePayoutProvider == nil {
		return AffiliatePayoutSweepResult{}, authdomain.ErrInvalidInput
	}
	now := s.clock.Now()
	result := AffiliatePayoutSweepResult{RanAt: now}
	for i := 0; i < 100; i++ {
		dispatch, found, err := s.affiliatePayouts.ClaimDueAffiliatePayout(ctx, s.ids.NewID(), now)
		if err != nil {
			return result, err
		}
		if !found {
			break
		}
		result.Claimed++
		providerResult, err := s.affiliatePayoutProvider.InitiateAffiliateTransfer(ctx, ports.InitiateAffiliateTransferInput{AmountMinor: dispatch.AmountMinor, RecipientCode: dispatch.RecipientCode, Reference: dispatch.Reference, Reason: "Xtiitch affiliate commission payout"})
		if err != nil {
			result.Failed++
			if recordErr := s.affiliatePayouts.RecordAffiliatePayoutAttempt(ctx, dispatch.PayoutBatchID, "", "failed", err.Error()); recordErr != nil {
				return result, recordErr
			}
			continue
		}
		result.Initiated++
		status := strings.ToLower(strings.TrimSpace(providerResult.Status))
		if status == "success" {
			result.Settled++
		} else {
			result.Pending++
		}
		if err = s.affiliatePayouts.RecordAffiliatePayoutAttempt(ctx, dispatch.PayoutBatchID, providerResult.TransferCode, status, ""); err != nil {
			return result, err
		}
	}
	_ = s.recordAudit(ctx, auditInput{ActorUserID: cmd.ActorUserID, ActorRole: cmd.ActorRole, Action: "affiliate.payout_sweep", TargetType: "affiliate_payout", TargetID: "automatic", TargetLabel: "Automatic affiliate payouts", Summary: "Ran automatic affiliate payout sweep.", Severity: admindomain.AuditSeverityInfo, Metadata: map[string]string{"reason": cmd.Reason}, IPAddress: cmd.IPAddress, UserAgent: cmd.UserAgent})
	return result, nil
}
