package adminauth

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo *fakeAdminBusinesses) ListAdminSubscriptionDiscountCodes(context.Context) ([]ports.AdminSubscriptionDiscountCodeRecord, error) {
	if repo.subscriptionDiscountCodes != nil {
		return repo.subscriptionDiscountCodes, nil
	}
	return []ports.AdminSubscriptionDiscountCodeRecord{
		fakeSubscriptionDiscountCodeRecord("discount-code-1", "WELCOME100", "percentage", 10000, true),
	}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminSubscriptionDiscountCode(
	_ context.Context,
	input ports.CreateAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	repo.createdDiscountCode = input
	return fakeSubscriptionDiscountCodeRecord(
		input.DiscountCodeID,
		input.Code,
		input.DiscountType,
		input.DiscountValue,
		input.Active,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminSubscriptionDiscountCode(
	_ context.Context,
	input ports.UpdateAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	repo.updatedDiscountCode = input
	return fakeSubscriptionDiscountCodeRecord(
		input.DiscountCodeID,
		input.Code,
		input.DiscountType,
		input.DiscountValue,
		input.Active,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminSubscriptionDiscountCode(
	_ context.Context,
	input ports.ArchiveAdminSubscriptionDiscountCodeInput,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	repo.archivedDiscountCode = input
	return fakeSubscriptionDiscountCodeRecord(
		input.DiscountCodeID,
		"WELCOME100",
		"percentage",
		10000,
		false,
	), nil
}

func fakeSubscriptionDiscountCodeRecord(
	discountCodeID common.ID,
	code string,
	discountType string,
	discountValue int,
	active bool,
) ports.AdminSubscriptionDiscountCodeRecord {
	return ports.AdminSubscriptionDiscountCodeRecord{
		DiscountCodeID:    discountCodeID,
		Code:              code,
		DiscountType:      discountType,
		DiscountValue:     discountValue,
		EligiblePlans:     []string{"starter", "growth"},
		EligibleCadences:  []string{"monthly", "yearly"},
		FirstPurchaseOnly: true,
		MaxPerAccount:     1,
		Active:            active,
		OwnerName:         "Test institution",
		BatchLabel:        "Launch",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}
