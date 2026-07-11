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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestAffiliatesRequireGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"affiliate-created", "audit-create", "audit-update", "audit-archive", "affiliate-invalid"},
	)

	affiliates, err := service.ListAffiliates(context.Background(), ListAffiliatesCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list affiliates: %v", err)
	}
	if len(affiliates) != 1 || affiliates[0].Code != "SEWINGPRO" {
		t.Fatalf("unexpected affiliates: %+v", affiliates)
	}

	created, err := service.CreateAffiliate(context.Background(), CreateAffiliateCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		EntityType:       " agency ",
		Code:             " sewing-pro ",
		DisplayName:      "  Sewing   Pro Partners ",
		ContactName:      "  Ama   Partner ",
		Email:            "AMA@EXAMPLE.COM",
		Phone:            " +233 20 000 0000 ",
		WebsiteURL:       "https://partners.example.com/ref",
		CommissionModel:  "percentage",
		CommissionRate:   1250,
		CookieWindowDays: 45,
		PayoutMode:       "paystack_transfer",
		PayoutReference:  " KYC transfer account ",
		Status:           "active",
		Notes:            " reviewed ",
		UserAgent:        "test-agent",
		IPAddress:        "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create affiliate: %v", err)
	}
	if created.AffiliateID != "affiliate-created" ||
		businesses.createdAffiliate.Code != "SEWING-PRO" ||
		businesses.createdAffiliate.Email != "ama@example.com" ||
		businesses.createdAffiliate.DisplayName != "Sewing Pro Partners" ||
		businesses.createdAffiliate.CookieWindowDays != 45 {
		t.Fatalf("expected normalized affiliate create, got input=%+v record=%+v", businesses.createdAffiliate, created)
	}

	updated, err := service.UpdateAffiliate(context.Background(), UpdateAffiliateCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		AffiliateID:      "affiliate-created",
		EntityType:       "agency",
		Code:             "SEWING-PRO",
		DisplayName:      "Sewing Pro Partners",
		CommissionModel:  "flat",
		CommissionRate:   5000,
		CookieWindowDays: 30,
		PayoutMode:       "manual",
		Status:           "paused",
		UserAgent:        "test-agent",
		IPAddress:        "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update affiliate: %v", err)
	}
	if businesses.updatedAffiliate.Status != "paused" || updated.Status != "paused" {
		t.Fatalf("expected paused affiliate update, got input=%+v record=%+v", businesses.updatedAffiliate, updated)
	}

	archived, err := service.ArchiveAffiliate(context.Background(), ArchiveAffiliateCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		AffiliateID: "affiliate-created",
		Reason:      " programme closed ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive affiliate: %v", err)
	}
	if businesses.archivedAffiliate.AffiliateID != "affiliate-created" || archived.Status != "archived" {
		t.Fatalf("expected archived affiliate, got input=%+v record=%+v", businesses.archivedAffiliate, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three affiliate audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created affiliate programme partner" ||
		audits.created[1].Action != "Updated affiliate programme partner" ||
		audits.created[2].Action != "Archived affiliate programme partner" ||
		audits.created[0].Metadata["code"] != "SEWING-PRO" {
		t.Fatalf("unexpected affiliate audit events: %+v", audits.created)
	}

	_, err = service.CreateAffiliate(context.Background(), CreateAffiliateCommand{
		ActorUserID:     "support-1",
		ActorRole:       admindomain.RoleSupport,
		Code:            "NOPE",
		DisplayName:     "Nope",
		CommissionModel: "percentage",
		CommissionRate:  100,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.CreateAffiliate(context.Background(), CreateAffiliateCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		Code:            "BAD",
		DisplayName:     "Bad",
		Email:           "bad-email",
		WebsiteURL:      "ftp://example.com",
		CommissionModel: "percentage",
		CommissionRate:  10001,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid affiliate fields, got %v", err)
	}
}

func TestAffiliateAttributionRequiresGrowthPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		affiliateAttribution: []ports.AdminAffiliateAttributionRecord{
			fakeAdminAffiliateAttributionRecord("affiliate-1", "SEWINGPRO", "Sewing Pro Partners"),
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	records, err := service.ListAffiliateAttribution(context.Background(), ListAffiliateAttributionCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list affiliate attribution: %v", err)
	}
	if len(records) != 1 ||
		records[0].Code != "SEWINGPRO" ||
		records[0].ClickCount != 12 ||
		records[0].ConversionCount != 2 ||
		len(records[0].RecentConversions) != 1 {
		t.Fatalf("unexpected affiliate attribution records: %+v", records)
	}

	_, err = service.ListAffiliateAttribution(context.Background(), ListAffiliateAttributionCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateAffiliateConversionStatusRequiresGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateAffiliateConversionStatus(
		context.Background(),
		UpdateAffiliateConversionStatusCommand{
			ActorUserID:  "operator-1",
			ActorRole:    admindomain.RoleOperator,
			ConversionID: "conversion-1",
			Status:       "approved",
			Reason:       "  order confirmed  ",
			UserAgent:    "test-agent",
			IPAddress:    "127.0.0.1",
		},
	)
	if err != nil {
		t.Fatalf("update affiliate conversion: %v", err)
	}
	if businesses.updatedAffiliateConversion.ConversionID != "conversion-1" ||
		businesses.updatedAffiliateConversion.Status != "approved" ||
		businesses.updatedAffiliateConversion.Reason != "order confirmed" {
		t.Fatalf("expected normalized conversion update, got %+v", businesses.updatedAffiliateConversion)
	}
	if record.Status != "approved" {
		t.Fatalf("unexpected conversion response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Marked affiliate conversion approved" ||
		event.TargetID != "conversion-1" ||
		event.Metadata["reason"] != "order confirmed" ||
		event.Metadata["commission_minor"] != "1500" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.UpdateAffiliateConversionStatus(
		context.Background(),
		UpdateAffiliateConversionStatusCommand{
			ActorUserID:  "support-1",
			ActorRole:    admindomain.RoleSupport,
			ConversionID: "conversion-1",
			Status:       "approved",
		},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.UpdateAffiliateConversionStatus(
		context.Background(),
		UpdateAffiliateConversionStatusCommand{
			ActorUserID:  "operator-1",
			ActorRole:    admindomain.RoleOperator,
			ConversionID: "conversion-1",
			Status:       "pending",
		},
	)
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid manual status, got %v", err)
	}
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestCreateAffiliatePayoutRequiresGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"payout-1", "audit-1"},
	)

	record, err := service.CreateAffiliatePayout(
		context.Background(),
		CreateAffiliatePayoutCommand{
			ActorUserID:     "operator-1",
			ActorRole:       admindomain.RoleOperator,
			AffiliateID:     "affiliate-1",
			PayoutReference: "  TRF_123  ",
			Notes:           "  sent from settled commission  ",
			UserAgent:       "test-agent",
			IPAddress:       "127.0.0.1",
		},
	)
	if err != nil {
		t.Fatalf("create affiliate payout: %v", err)
	}
	if businesses.createdAffiliatePayout.PayoutBatchID != "payout-1" ||
		businesses.createdAffiliatePayout.AffiliateID != "affiliate-1" ||
		businesses.createdAffiliatePayout.PayoutReference != "TRF_123" ||
		businesses.createdAffiliatePayout.Notes != "sent from settled commission" {
		t.Fatalf("expected normalized payout input, got %+v", businesses.createdAffiliatePayout)
	}
	if record.PayoutBatchID != "payout-1" ||
		record.Status != "settled" ||
		record.ConversionCount != 2 ||
		record.CommissionMinor != 2500 {
		t.Fatalf("unexpected payout response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Reconciled affiliate payout" ||
		event.TargetID != "payout-1" ||
		event.Metadata["affiliate_id"] != "affiliate-1" ||
		event.Metadata["conversion_count"] != "2" ||
		event.Metadata["commission_minor"] != "2500" ||
		event.Metadata["payout_reference"] != "TRF_123" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.CreateAffiliatePayout(
		context.Background(),
		CreateAffiliatePayoutCommand{
			ActorUserID: "support-1",
			ActorRole:   admindomain.RoleSupport,
			AffiliateID: "affiliate-1",
		},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminAffiliates(context.Context) ([]ports.AdminAffiliateRecord, error) {
	if repo.affiliates != nil {
		return repo.affiliates, nil
	}
	return []ports.AdminAffiliateRecord{fakeAdminAffiliateRecord(
		"affiliate-1",
		"SEWINGPRO",
		"Sewing Pro Partners",
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) ListAdminAffiliateAttribution(context.Context) ([]ports.AdminAffiliateAttributionRecord, error) {
	if repo.affiliateAttribution != nil {
		return repo.affiliateAttribution, nil
	}
	return []ports.AdminAffiliateAttributionRecord{
		fakeAdminAffiliateAttributionRecord("affiliate-1", "SEWINGPRO", "Sewing Pro Partners"),
	}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAffiliatePayout(
	_ context.Context,
	input ports.CreateAdminAffiliatePayoutInput,
) (ports.AdminAffiliatePayoutRecord, error) {
	repo.createdAffiliatePayout = input
	now := time.Now()
	return ports.AdminAffiliatePayoutRecord{
		PayoutBatchID:   input.PayoutBatchID,
		AffiliateID:     input.AffiliateID,
		DisplayName:     "Sewing Pro Partners",
		PayoutMode:      "paystack_transfer",
		PayoutReference: input.PayoutReference,
		ConversionCount: 2,
		GrossMinor:      25000,
		CommissionMinor: 2500,
		Status:          "settled",
		Notes:           input.Notes,
		CreatedAt:       now,
		UpdatedAt:       now,
	}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminAffiliate(
	_ context.Context,
	input ports.CreateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	repo.createdAffiliate = input
	return fakeAdminAffiliateRecord(
		input.AffiliateID,
		input.Code,
		input.DisplayName,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminAffiliate(
	_ context.Context,
	input ports.UpdateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	repo.updatedAffiliate = input
	return fakeAdminAffiliateRecord(
		input.AffiliateID,
		input.Code,
		input.DisplayName,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminAffiliate(
	_ context.Context,
	input ports.ArchiveAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	repo.archivedAffiliate = input
	return fakeAdminAffiliateRecord(
		input.AffiliateID,
		"SEWINGPRO",
		"Sewing Pro Partners",
		"archived",
	), nil
}

func fakeAdminAffiliateRecord(
	affiliateID common.ID,
	code string,
	displayName string,
	status string,
) ports.AdminAffiliateRecord {
	now := time.Now()
	return ports.AdminAffiliateRecord{
		AffiliateID:      affiliateID,
		EntityType:       "agency",
		Code:             code,
		DisplayName:      displayName,
		ContactName:      "Ama Partner",
		Email:            "ama@example.com",
		Phone:            "+233 20 000 0000",
		WebsiteURL:       "https://partners.example.com/ref",
		CommissionModel:  "percentage",
		CommissionRate:   1250,
		CookieWindowDays: 45,
		PayoutMode:       "paystack_transfer",
		PayoutReference:  "KYC transfer account",
		Status:           status,
		Notes:            "reviewed",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

func fakeAdminAffiliateAttributionRecord(
	affiliateID common.ID,
	code string,
	displayName string,
) ports.AdminAffiliateAttributionRecord {
	now := time.Now()
	return ports.AdminAffiliateAttributionRecord{
		AffiliateID:             affiliateID,
		Code:                    code,
		DisplayName:             displayName,
		ClickCount:              12,
		ConversionCount:         2,
		PendingConversionCount:  1,
		ApprovedConversionCount: 1,
		GrossMinor:              25000,
		CommissionMinor:         2500,
		LastActivityAt:          &now,
		RecentConversions: []ports.AdminAffiliateConversionRecord{
			{
				ConversionID:     "conversion-1",
				AffiliateID:      affiliateID,
				BusinessID:       "business-1",
				BusinessName:     "Ama Stitches",
				OrderID:          "order-1",
				GrossMinor:       15000,
				CommissionMinor:  1500,
				Status:           "pending",
				AttributionModel: "last_click",
				CreatedAt:        now,
				UpdatedAt:        now,
			},
		},
		RecentPayouts: []ports.AdminAffiliatePayoutRecord{
			{
				PayoutBatchID:   "payout-1",
				AffiliateID:     affiliateID,
				DisplayName:     displayName,
				PayoutMode:      "paystack_transfer",
				PayoutReference: "TRF_123",
				ConversionCount: 2,
				GrossMinor:      25000,
				CommissionMinor: 2500,
				Status:          "settled",
				Notes:           "sent from settled commission",
				CreatedAt:       now,
				UpdatedAt:       now,
			},
		},
	}
}
