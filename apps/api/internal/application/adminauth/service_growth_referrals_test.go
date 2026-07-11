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
func TestReferralProgrammesRequireGrowthPermissionAndAudit(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	startsAt := now.Add(24 * time.Hour)
	endsAt := startsAt.Add(30 * 24 * time.Hour)
	maxRewardMinor := int64(5000)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"referral-created", "audit-create", "audit-update", "audit-archive", "referral-invalid"},
	)

	programmes, err := service.ListReferralProgrammes(context.Background(), ListReferralProgrammesCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list referral programmes: %v", err)
	}
	if len(programmes) != 1 || programmes[0].CodePrefix != "LAUNCH" {
		t.Fatalf("unexpected referral programmes: %+v", programmes)
	}

	created, err := service.CreateReferralProgramme(context.Background(), CreateReferralProgrammeCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		Title:                   "  Local   Launch Referrals ",
		CodePrefix:              " ref-local ",
		Audience:                " mixed ",
		ReferrerRewardKind:      "voucher",
		RefereeRewardKind:       "voucher",
		RewardType:              "percentage",
		RewardValue:             1250,
		MaxRewardMinor:          &maxRewardMinor,
		QualifyingOrderMinMinor: 20000,
		RewardHoldDays:          21,
		Status:                  "active",
		StartsAt:                &startsAt,
		EndsAt:                  &endsAt,
		Notes:                   " launch cohort ",
		UserAgent:               "test-agent",
		IPAddress:               "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create referral programme: %v", err)
	}
	if created.ProgrammeID != "referral-created" ||
		businesses.createdReferralProgramme.Title != "Local Launch Referrals" ||
		businesses.createdReferralProgramme.CodePrefix != "REF-LOCAL" ||
		businesses.createdReferralProgramme.Audience != "mixed" ||
		businesses.createdReferralProgramme.RewardHoldDays != 21 ||
		businesses.createdReferralProgramme.MaxRewardMinor == nil ||
		*businesses.createdReferralProgramme.MaxRewardMinor != maxRewardMinor {
		t.Fatalf("expected normalized referral create, got input=%+v record=%+v", businesses.createdReferralProgramme, created)
	}

	updated, err := service.UpdateReferralProgramme(context.Background(), UpdateReferralProgrammeCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		ProgrammeID:             "referral-created",
		Title:                   "Local Launch Referrals",
		CodePrefix:              "REF-LOCAL",
		Audience:                "customers",
		ReferrerRewardKind:      "commission_rebate",
		RefereeRewardKind:       "none",
		RewardType:              "fixed",
		RewardValue:             2500,
		QualifyingOrderMinMinor: 10000,
		RewardHoldDays:          7,
		Status:                  "paused",
		UserAgent:               "test-agent",
		IPAddress:               "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update referral programme: %v", err)
	}
	if businesses.updatedReferralProgramme.Status != "paused" ||
		businesses.updatedReferralProgramme.RewardType != "fixed" ||
		businesses.updatedReferralProgramme.MaxRewardMinor != nil ||
		updated.Status != "paused" {
		t.Fatalf("expected paused referral update, got input=%+v record=%+v", businesses.updatedReferralProgramme, updated)
	}

	archived, err := service.ArchiveReferralProgramme(context.Background(), ArchiveReferralProgrammeCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ProgrammeID: "referral-created",
		Reason:      " programme ended ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive referral programme: %v", err)
	}
	if businesses.archivedReferralProgramme.ProgrammeID != "referral-created" || archived.Status != "archived" {
		t.Fatalf("expected archived referral programme, got input=%+v record=%+v", businesses.archivedReferralProgramme, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three referral audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created referral programme" ||
		audits.created[1].Action != "Updated referral programme" ||
		audits.created[2].Action != "Archived referral programme" ||
		audits.created[0].Metadata["code_prefix"] != "REF-LOCAL" {
		t.Fatalf("unexpected referral audit events: %+v", audits.created)
	}

	_, err = service.CreateReferralProgramme(context.Background(), CreateReferralProgrammeCommand{
		ActorUserID:             "support-1",
		ActorRole:               admindomain.RoleSupport,
		Title:                   "Nope",
		CodePrefix:              "NOPE",
		ReferrerRewardKind:      "voucher",
		RefereeRewardKind:       "voucher",
		RewardType:              "fixed",
		RewardValue:             1000,
		QualifyingOrderMinMinor: 0,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.CreateReferralProgramme(context.Background(), CreateReferralProgrammeCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		Title:                   "Bad",
		CodePrefix:              "BAD",
		ReferrerRewardKind:      "none",
		RefereeRewardKind:       "none",
		RewardType:              "percentage",
		RewardValue:             10100,
		QualifyingOrderMinMinor: -1,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid referral programme fields, got %v", err)
	}
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestCreateReferralCodeRequiresGrowthPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 13, 0, 0, 0, time.UTC)
	businessID := common.ID("business-1")
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"referral-code-1", "audit-code-1", "referral-code-invalid"},
	)

	record, err := service.CreateReferralCode(context.Background(), CreateReferralCodeCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ProgrammeID: "programme-1",
		BusinessID:  &businessID,
		OwnerType:   " business ",
		Code:        " ama-team ",
		Status:      "paused",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create referral code: %v", err)
	}
	if record.ReferralCodeID != "referral-code-1" ||
		businesses.createdReferralCode.ProgrammeID != "programme-1" ||
		businesses.createdReferralCode.BusinessID == nil ||
		*businesses.createdReferralCode.BusinessID != businessID ||
		businesses.createdReferralCode.OwnerType != "business" ||
		businesses.createdReferralCode.Code != "AMA-TEAM" ||
		businesses.createdReferralCode.Status != "paused" {
		t.Fatalf("expected normalized referral code input, got input=%+v record=%+v", businesses.createdReferralCode, record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Issued referral code" ||
		event.Metadata["referral_programme_id"] != "programme-1" ||
		event.Metadata["business_id"] != businessID.String() ||
		event.Metadata["owner_business_id"] != businessID.String() ||
		event.Metadata["code"] != "AMA-TEAM" ||
		event.Metadata["status"] != "paused" {
		t.Fatalf("unexpected referral code audit event: %+v", event)
	}

	_, err = service.CreateReferralCode(context.Background(), CreateReferralCodeCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		ProgrammeID: "programme-1",
		Code:        "SUPPORT1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	_, err = service.CreateReferralCode(context.Background(), CreateReferralCodeCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		ProgrammeID: "programme-1",
		OwnerType:   "business",
		Code:        "NO",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid code input, got %v", err)
	}
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestIssueReferralRewardsRequiresGrowthPermissionAndAudits(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		now,
		[]common.ID{"audit-1"},
	)

	record, err := service.IssueReferralRewards(context.Background(), IssueReferralRewardsCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		Limit:       999,
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("issue referral rewards: %v", err)
	}
	if businesses.issuedReferralRewards.ActorAdminUser != "operator-1" ||
		businesses.issuedReferralRewards.Limit != 500 {
		t.Fatalf("expected normalized reward issue input, got %+v", businesses.issuedReferralRewards)
	}
	if record.ReferralCount != 2 ||
		record.RewardCount != 3 ||
		record.VoucherCount != 2 ||
		record.CommissionRebateCount != 1 ||
		record.TotalRewardMinor != 10000 {
		t.Fatalf("unexpected reward issue record: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	event := audits.created[0]
	if event.Action != "Issued referral rewards" ||
		event.Metadata["reward_count"] != "3" ||
		event.Metadata["voucher_count"] != "2" ||
		event.Metadata["commission_rebate_count"] != "1" ||
		event.Metadata["limit"] != "500" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	_, err = service.IssueReferralRewards(context.Background(), IssueReferralRewardsCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminReferralProgrammes(context.Context) ([]ports.AdminReferralProgrammeRecord, error) {
	if repo.referralProgrammes != nil {
		return repo.referralProgrammes, nil
	}
	return []ports.AdminReferralProgrammeRecord{fakeAdminReferralProgrammeRecord(
		"referral-programme-1",
		"Launch referrals",
		"LAUNCH",
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminReferralProgramme(
	_ context.Context,
	input ports.CreateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	repo.createdReferralProgramme = input
	return fakeAdminReferralProgrammeRecord(
		input.ProgrammeID,
		input.Title,
		input.CodePrefix,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminReferralProgramme(
	_ context.Context,
	input ports.UpdateAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	repo.updatedReferralProgramme = input
	return fakeAdminReferralProgrammeRecord(
		input.ProgrammeID,
		input.Title,
		input.CodePrefix,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminReferralProgramme(
	_ context.Context,
	input ports.ArchiveAdminReferralProgrammeInput,
) (ports.AdminReferralProgrammeRecord, error) {
	repo.archivedReferralProgramme = input
	return fakeAdminReferralProgrammeRecord(
		input.ProgrammeID,
		"Launch referrals",
		"LAUNCH",
		"archived",
	), nil
}

func (repo *fakeAdminBusinesses) CreateAdminReferralCode(
	_ context.Context,
	input ports.CreateAdminReferralCodeInput,
) (ports.AdminReferralCodeRecord, error) {
	repo.createdReferralCode = input
	record := ports.AdminReferralCodeRecord{
		ReferralCodeID: input.ReferralCodeID,
		ProgrammeID:    input.ProgrammeID,
		BusinessID:     input.BusinessID,
		OwnerType:      input.OwnerType,
		Code:           input.Code,
		Status:         input.Status,
		OwnerLabel:     "Platform",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if input.BusinessID != nil {
		record.OwnerBusinessID = input.BusinessID
		record.BusinessName = "Ama Stitches"
		record.BusinessHandle = "ama-stitches"
		record.OwnerLabel = "Ama Stitches"
	}
	return record, nil
}

func (repo *fakeAdminBusinesses) IssueAdminReferralRewards(
	_ context.Context,
	input ports.IssueAdminReferralRewardsInput,
) (ports.AdminReferralRewardIssueRecord, error) {
	repo.issuedReferralRewards = input
	return ports.AdminReferralRewardIssueRecord{
		ReferralCount:         2,
		RewardCount:           3,
		VoucherCount:          2,
		CommissionRebateCount: 1,
		TotalRewardMinor:      10000,
		IssuedAt:              time.Now(),
	}, nil
}

func fakeAdminReferralProgrammeRecord(
	programmeID common.ID,
	title string,
	codePrefix string,
	status string,
) ports.AdminReferralProgrammeRecord {
	now := time.Now()
	maxReward := int64(10000)
	return ports.AdminReferralProgrammeRecord{
		ProgrammeID:             programmeID,
		Title:                   title,
		CodePrefix:              codePrefix,
		Audience:                "customers",
		ReferrerRewardKind:      "voucher",
		RefereeRewardKind:       "voucher",
		RewardType:              "percentage",
		RewardValue:             1000,
		MaxRewardMinor:          &maxReward,
		QualifyingOrderMinMinor: 50000,
		RewardHoldDays:          14,
		Status:                  status,
		Notes:                   "launch referral programme",
		CreatedAt:               now,
		UpdatedAt:               now,
	}
}

func intPtr(value int) *int {
	return &value
}

func int64Ptr(value int64) *int64 {
	return &value
}
