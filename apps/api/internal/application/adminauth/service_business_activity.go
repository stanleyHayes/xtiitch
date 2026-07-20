package adminauth

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// businessActivityCategories are the feed arms the type filter accepts (§11.3).
const (
	activityCategoryOrders       = "orders"
	activityCategoryPayments     = "payments"
	activityCategoryBilling      = "billing"
	activityCategoryPayouts      = "payouts"
	activityCategoryVerification = "verification"
	activityCategoryAdmin        = "admin"
	activityCategoryTakings      = "takings"
)

var validBusinessActivityCategories = map[string]bool{
	activityCategoryOrders:       true,
	activityCategoryPayments:     true,
	activityCategoryBilling:      true,
	activityCategoryPayouts:      true,
	activityCategoryVerification: true,
	activityCategoryAdmin:        true,
	activityCategoryTakings:      true,
}

const (
	defaultActivityPageSize = 50
	maxActivityPageSize     = 200
)

type ListBusinessActivityCommand struct {
	ActorRole  admindomain.Role
	BusinessID common.ID
	Category   string
	Limit      int
	Offset     int
}

// ListBusinessActivity is the §11.3 full activity history for one business: a
// unified, newest-first feed across orders, payments, billing, payouts,
// verification, admin actions and manual takings — the record an operator reads
// to settle disputes and judge how a business is performing. Read-only, same
// permission as the business directory.
func (s Service) ListBusinessActivity(
	ctx context.Context,
	cmd ListBusinessActivityCommand,
) ([]ports.AdminBusinessActivityRecord, error) {
	if cmd.BusinessID.IsZero() {
		return nil, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}
	if cmd.Category != "" && !validBusinessActivityCategories[cmd.Category] {
		return nil, authdomain.ErrInvalidInput
	}
	if cmd.Offset < 0 {
		return nil, authdomain.ErrInvalidInput
	}
	limit := cmd.Limit
	if limit <= 0 {
		limit = defaultActivityPageSize
	}
	if limit > maxActivityPageSize {
		limit = maxActivityPageSize
	}

	return s.businesses.ListAdminBusinessActivity(ctx, ports.ListAdminBusinessActivityInput{
		BusinessID: cmd.BusinessID,
		Category:   cmd.Category,
		Limit:      limit,
		Offset:     cmd.Offset,
	})
}
