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

func TestListSubscriptionsRequiresSubscriptionPermission(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		subscriptions: []ports.AdminSubscriptionRecord{
			{SubscriptionID: "subscription-1", BusinessID: "business-1", BusinessName: "Ama Stitches"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	subscriptions, err := service.ListSubscriptions(context.Background(), ListSubscriptionsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list subscriptions: %v", err)
	}
	if len(subscriptions) != 1 || subscriptions[0].BusinessID != "business-1" {
		t.Fatalf("unexpected subscriptions: %+v", subscriptions)
	}

	_, err = service.ListSubscriptions(context.Background(), ListSubscriptionsCommand{
		ActorRole: admindomain.RoleSupport,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestUpdateSubscriptionRequiresPermissionAndAudits(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-1"},
	)

	record, err := service.UpdateSubscription(context.Background(), UpdateSubscriptionCommand{
		ActorUserID:             "operator-1",
		ActorRole:               admindomain.RoleOperator,
		BusinessID:              "business-1",
		Status:                  " grace_period ",
		BillingMode:             " recurring ",
		ProviderCustomerRef:     " CUS_123 ",
		ProviderSubscriptionRef: " SUB_123 ",
		Reason:                  " card failed twice ",
		UserAgent:               "test-agent",
		IPAddress:               "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update subscription: %v", err)
	}
	if businesses.subscriptionUpdate.Status != "grace_period" ||
		businesses.subscriptionUpdate.BillingMode != "recurring" ||
		businesses.subscriptionUpdate.ProviderCustomerRef != "CUS_123" ||
		businesses.subscriptionUpdate.ProviderSubscriptionRef != "SUB_123" ||
		businesses.subscriptionUpdate.Reason != "card failed twice" {
		t.Fatalf("expected normalized subscription update, got %+v", businesses.subscriptionUpdate)
	}
	if record.BusinessID != "business-1" || record.Status != "grace_period" {
		t.Fatalf("unexpected subscription response: %+v", record)
	}
	if len(audits.created) != 1 {
		t.Fatalf("expected one audit event, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Updated subscription" ||
		audits.created[0].Severity != admindomain.AuditSeverityWarning ||
		audits.created[0].Metadata["billing_mode"] != "recurring" ||
		audits.created[0].Metadata["provider_subscription_ref"] != "SUB_123" {
		t.Fatalf("unexpected audit event: %+v", audits.created[0])
	}

	_, err = service.UpdateSubscription(context.Background(), UpdateSubscriptionCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		BusinessID:  "business-1",
		Status:      "active",
		BillingMode: "recurring",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected recurring billing to require a subscription ref, got %v", err)
	}

	_, err = service.UpdateSubscription(context.Background(), UpdateSubscriptionCommand{
		ActorUserID: "support-1",
		ActorRole:   admindomain.RoleSupport,
		BusinessID:  "business-1",
		Status:      "active",
		BillingMode: "manual",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminSubscriptions(context.Context) ([]ports.AdminSubscriptionRecord, error) {
	if repo.subscriptions != nil {
		return repo.subscriptions, nil
	}
	return []ports.AdminSubscriptionRecord{
		{
			SubscriptionID:     "subscription-1",
			BusinessID:         "business-1",
			BusinessName:       "Ama Stitches",
			Handle:             "ama-stitches",
			PlanCode:           "growth",
			PlanName:           "Growth",
			Status:             "active",
			BillingMode:        "manual",
			CurrentPeriodStart: time.Now(),
			CurrentPeriodEnd:   time.Now().Add(30 * 24 * time.Hour),
			UpdatedAt:          time.Now(),
		},
	}, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminSubscription(
	_ context.Context,
	input ports.UpdateAdminSubscriptionInput,
) (ports.AdminSubscriptionRecord, error) {
	repo.subscriptionUpdate = input
	return ports.AdminSubscriptionRecord{
		SubscriptionID:          "subscription-1",
		BusinessID:              input.BusinessID,
		BusinessName:            "Ama Stitches",
		Handle:                  "ama-stitches",
		PlanCode:                "growth",
		PlanName:                "Growth",
		Status:                  input.Status,
		BillingMode:             input.BillingMode,
		ProviderCustomerRef:     input.ProviderCustomerRef,
		ProviderSubscriptionRef: input.ProviderSubscriptionRef,
		CurrentPeriodStart:      time.Now(),
		CurrentPeriodEnd:        time.Now().Add(30 * 24 * time.Hour),
		UpdatedAt:               time.Now(),
	}, nil
}
