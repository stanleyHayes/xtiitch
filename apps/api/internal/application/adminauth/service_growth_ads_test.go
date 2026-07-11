package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestAdCampaignsRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	startsAt := now.Add(24 * time.Hour)
	endsAt := startsAt.Add(7 * 24 * time.Hour)
	dailyCap := int64(15000)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"campaign-created", "audit-create", "audit-update", "audit-archive"},
	)

	campaigns, err := service.ListAdCampaigns(context.Background(), ListAdCampaignsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list ad campaigns: %v", err)
	}
	if len(campaigns) != 1 || campaigns[0].Headline != "Featured Atelier" {
		t.Fatalf("unexpected ad campaigns: %+v", campaigns)
	}

	created, err := service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		BusinessID:    "business-1",
		PlacementType: " homepage_hero ",
		Headline:      "  Launch   spotlight  ",
		Description:   "  homepage slot  ",
		Status:        "active",
		PricingModel:  "flat_time",
		BudgetMinor:   50000,
		DailyCapMinor: &dailyCap,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
		ReviewNote:    " verified advertiser ",
		UserAgent:     "test-agent",
		IPAddress:     "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create ad campaign: %v", err)
	}
	if created.CampaignID != "campaign-created" ||
		businesses.createdAdCampaign.Headline != "Launch spotlight" ||
		businesses.createdAdCampaign.Description != "homepage slot" ||
		*businesses.createdAdCampaign.DailyCapMinor != 15000 ||
		businesses.createdAdCampaign.ReviewNote != "verified advertiser" {
		t.Fatalf("expected normalized create input, got input=%+v record=%+v", businesses.createdAdCampaign, created)
	}

	updated, err := service.UpdateAdCampaign(context.Background(), UpdateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		CampaignID:    "campaign-created",
		BusinessID:    "business-1",
		PlacementType: "featured_business",
		Headline:      "Launch spotlight paused",
		Status:        "paused",
		PricingModel:  "flat_time",
		BudgetMinor:   50000,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
		UserAgent:     "test-agent",
		IPAddress:     "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update ad campaign: %v", err)
	}
	if businesses.updatedAdCampaign.Status != "paused" || updated.Status != "paused" {
		t.Fatalf("expected paused update, got input=%+v record=%+v", businesses.updatedAdCampaign, updated)
	}

	archived, err := service.ArchiveAdCampaign(context.Background(), ArchiveAdCampaignCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		CampaignID:  "campaign-created",
		Reason:      " campaign ended ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive ad campaign: %v", err)
	}
	if businesses.archivedAdCampaign.CampaignID != "campaign-created" || archived.Status != "archived" {
		t.Fatalf("expected archived campaign, got input=%+v record=%+v", businesses.archivedAdCampaign, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created sponsored placement" ||
		audits.created[1].Action != "Updated sponsored placement" ||
		audits.created[2].Action != "Archived sponsored placement" ||
		audits.created[0].Metadata["placement_type"] != "homepage_hero" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "support-1",
		ActorRole:     admindomain.RoleSupport,
		BusinessID:    "business-1",
		PlacementType: "featured_business",
		Headline:      "Nope",
		Status:        "active",
		PricingModel:  "flat_time",
		BudgetMinor:   100,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestCollectAdCampaignPaymentCreatesProviderLinkAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		adPaymentIntent: ports.AdminAdCampaignPaymentIntentRecord{
			CampaignID:   "campaign-1",
			BusinessID:   "business-1",
			BusinessName: "Ama Stitches",
			OwnerEmail:   "owner@example.com",
			Headline:     "Featured Atelier",
			BudgetMinor:  50000,
			PaidMinor:    12500,
			DueMinor:     37500,
		},
	}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"payment-1", "reference-1", "audit-1"},
	)
	provider := &fakePaymentProvider{}
	service.payments = provider

	result, err := service.CollectAdCampaignPayment(context.Background(), CollectAdCampaignPaymentCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		CampaignID:  "campaign-1",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("collect ad campaign payment: %v", err)
	}
	if provider.initialized.CustomerEmail != "owner@example.com" ||
		provider.initialized.AmountMinor != 37500 ||
		provider.initialized.SubaccountRef != "" ||
		provider.initialized.Reference != "xt_ad_reference-1" {
		t.Fatalf("expected platform Paystack transaction, got %+v", provider.initialized)
	}
	if businesses.createdAdCampaignPayment.PaymentID != "payment-1" ||
		businesses.createdAdCampaignPayment.ProviderReference != "PAY_xt_ad_reference-1" ||
		businesses.createdAdCampaignPayment.PaymentURL == "" {
		t.Fatalf("expected stored campaign payment input, got %+v", businesses.createdAdCampaignPayment)
	}
	if !result.Created ||
		result.Payment.AmountMinor != 37500 ||
		result.AuthorizationURL != "https://paystack.test/xt_ad_reference-1" {
		t.Fatalf("unexpected payment result: %+v", result)
	}
	if len(audits.created) != 1 ||
		audits.created[0].Action != "Created sponsored placement payment link" ||
		audits.created[0].Metadata["provider_reference"] != "PAY_xt_ad_reference-1" {
		t.Fatalf("unexpected audit event: %+v", audits.created)
	}

	_, err = service.CollectAdCampaignPayment(context.Background(), CollectAdCampaignPaymentCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		CampaignID:  "campaign-1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestAdCampaignValidation(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	startsAt := now.Add(24 * time.Hour)
	endsAt := startsAt.Add(7 * 24 * time.Hour)
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		&fakeAdminBusinesses{},
		now,
		[]common.ID{"campaign", "audit"},
	)

	_, err := service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		BusinessID:    "business-1",
		PlacementType: "promoted_design",
		Headline:      "Missing target",
		Status:        "active",
		PricingModel:  "flat_time",
		BudgetMinor:   10000,
		StartsAt:      &startsAt,
		EndsAt:        &endsAt,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected missing promoted design target to fail, got %v", err)
	}

	dailyCap := int64(-1)
	_, err = service.CreateAdCampaign(context.Background(), CreateAdCampaignCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		BusinessID:    "business-1",
		PlacementType: "featured_business",
		Headline:      "Bad cap",
		Status:        "active",
		PricingModel:  "cpc",
		BudgetMinor:   0,
		DailyCapMinor: &dailyCap,
		StartsAt:      &endsAt,
		EndsAt:        &startsAt,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid campaign economics/window, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminAdCampaigns(context.Context) ([]ports.AdminAdCampaignRecord, error) {
	if repo.adCampaigns != nil {
		return repo.adCampaigns, nil
	}
	return []ports.AdminAdCampaignRecord{fakeAdminAdCampaignRecord(
		"campaign-1",
		"business-1",
		"featured_business",
		"Featured Atelier",
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAdCampaign(
	_ context.Context,
	input ports.CreateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	repo.createdAdCampaign = input
	return fakeAdminAdCampaignRecord(
		input.CampaignID,
		input.BusinessID,
		input.PlacementType,
		input.Headline,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminAdCampaign(
	_ context.Context,
	input ports.UpdateAdminAdCampaignInput,
) (ports.AdminAdCampaignRecord, error) {
	repo.updatedAdCampaign = input
	return fakeAdminAdCampaignRecord(
		input.CampaignID,
		input.BusinessID,
		input.PlacementType,
		input.Headline,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) GetAdminAdCampaignPaymentIntent(
	context.Context,
	common.ID,
) (ports.AdminAdCampaignPaymentIntentRecord, error) {
	if !repo.adPaymentIntent.CampaignID.IsZero() {
		return repo.adPaymentIntent, nil
	}
	return ports.AdminAdCampaignPaymentIntentRecord{
		CampaignID:   "campaign-1",
		BusinessID:   "business-1",
		BusinessName: "Ama Stitches",
		OwnerEmail:   "owner@example.com",
		Headline:     "Featured Atelier",
		BudgetMinor:  50000,
		PaidMinor:    12500,
		DueMinor:     37500,
	}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAdCampaignPayment(
	_ context.Context,
	input ports.CreateAdminAdCampaignPaymentInput,
) (ports.AdminAdCampaignPaymentRecord, error) {
	repo.createdAdCampaignPayment = input
	now := time.Now()
	return ports.AdminAdCampaignPaymentRecord{
		PaymentID:         input.PaymentID,
		CampaignID:        input.CampaignID,
		BusinessID:        input.BusinessID,
		Provider:          "paystack",
		ProviderReference: input.ProviderReference,
		PaymentURL:        input.PaymentURL,
		AmountMinor:       input.AmountMinor,
		Currency:          input.Currency,
		Status:            "initiated",
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

func fakeAdminAdCampaignRecord(
	campaignID common.ID,
	businessID common.ID,
	placementType string,
	headline string,
	status string,
) ports.AdminAdCampaignRecord {
	now := time.Now()
	return ports.AdminAdCampaignRecord{
		CampaignID:      campaignID,
		BusinessID:      businessID,
		BusinessName:    "Ama Stitches",
		BusinessHandle:  "ama-stitches",
		PlacementType:   placementType,
		TargetLabel:     "Ama Stitches",
		Headline:        headline,
		Description:     "homepage slot",
		Status:          status,
		PricingModel:    "flat_time",
		BudgetMinor:     50000,
		SpendMinor:      12500,
		DailyCapMinor:   int64Ptr(15000),
		StartsAt:        now,
		EndsAt:          now.Add(7 * 24 * time.Hour),
		ImpressionCount: 100,
		ClickCount:      8,
		ClickRateBPS:    800,
		ReviewNote:      "verified advertiser",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}
