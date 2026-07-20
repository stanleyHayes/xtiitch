package paymentsapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type LogManualTakingCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	ActorUserID common.ID
	OrderID     *common.ID
	AmountMinor int64
	Method      string
	WhatFor     string
}

type LogManualTakingResult struct {
	TakingID         common.ID
	CommissionMinor  int64
	CommissionStatus string
}

// LogManualTaking records an off-platform sale (cash/momo/other) for the money
// tracker. Off-platform money is always fee-free: the platform commission
// applies only to payments processed through Paystack. A manually logged taking
// never flows through the provider, so no commission is deducted or accrued —
// it carries zero commission and a "not_applicable" status.
func (s Service) LogManualTaking(ctx context.Context, cmd LogManualTakingCommand) (LogManualTakingResult, error) {
	if err := authorizeMoneyManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return LogManualTakingResult{}, err
	}
	if cmd.AmountMinor <= 0 {
		return LogManualTakingResult{}, ErrInvalidTaking
	}
	switch cmd.Method {
	case "cash", "momo", "other":
	default:
		return LogManualTakingResult{}, ErrInvalidTaking
	}

	info, err := s.businesses.GetChargeContext(ctx, cmd.Scope)
	if err != nil {
		return LogManualTakingResult{}, err
	}
	businessID := info.BusinessID
	if businessID.IsZero() {
		businessID = cmd.Scope.BusinessID
	}

	id := s.ids.NewID()
	if err := s.payments.RecordManualTaking(ctx, cmd.Scope, ports.ManualTakingInput{
		TakingID:         id,
		BusinessID:       businessID,
		OrderID:          cmd.OrderID,
		AmountMinor:      cmd.AmountMinor,
		Method:           cmd.Method,
		WhatFor:          strings.TrimSpace(cmd.WhatFor),
		CommissionBps:    0,
		CommissionMinor:  0,
		CommissionStatus: "not_applicable",
		CommissionNote:   "",
		// §14.1 team analytics: attribute the taking to whoever logged it.
		LoggedByUserID: cmd.ActorUserID,
	}); err != nil {
		return LogManualTakingResult{}, err
	}
	return LogManualTakingResult{
		TakingID:         id,
		CommissionMinor:  0,
		CommissionStatus: "not_applicable",
	}, nil
}

func (s Service) ListManualTakings(ctx context.Context, scope common.TenantScope) ([]ports.ManualTakingRecord, error) {
	return s.payments.ListManualTakings(ctx, scope)
}

// MoneySummary reads the Money Desk aggregates. It first kicks a BEST-EFFORT,
// throttled settlement sync (§3.2/§3.3): the desk must reflect payouts near
// real time, but a provider hiccup must never break the read — a failed sync
// is swallowed and the desk renders the last mirrored figures.
func (s Service) MoneySummary(ctx context.Context, scope common.TenantScope) (ports.MoneySummary, error) {
	_, _ = s.SyncSettlements(ctx, SyncSettlementsCommand{BusinessID: scope.BusinessID})
	return s.payments.MoneySummary(ctx, scope)
}
