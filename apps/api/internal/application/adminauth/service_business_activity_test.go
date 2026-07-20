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

func (repo *fakeAdminBusinesses) ListAdminBusinessActivity(
	_ context.Context,
	input ports.ListAdminBusinessActivityInput,
) ([]ports.AdminBusinessActivityRecord, error) {
	repo.activityInput = input
	if repo.activityErr != nil {
		return nil, repo.activityErr
	}
	return repo.activity, nil
}

// §11.3: the feed is paged with sane clamps and the type filter is a closed set
// — an unknown category must not silently return an unfiltered feed.
func TestListBusinessActivityValidatesAndClamps(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{
		activity: []ports.AdminBusinessActivityRecord{
			{EventType: "order_created", Category: "orders", Summary: "Standard order placed"},
		},
	}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	records, err := service.ListBusinessActivity(context.Background(), ListBusinessActivityCommand{
		ActorRole:  admindomain.RoleOperator,
		BusinessID: "business-1",
		Category:   "orders",
		Limit:      10000,
		Offset:     5,
	})
	if err != nil {
		t.Fatalf("list business activity: %v", err)
	}
	if len(records) != 1 || records[0].Category != "orders" {
		t.Fatalf("unexpected activity records: %+v", records)
	}
	if businesses.activityInput.Limit != maxActivityPageSize {
		t.Fatalf("expected the page size to clamp to %d, got %d", maxActivityPageSize, businesses.activityInput.Limit)
	}
	if businesses.activityInput.Offset != 5 || businesses.activityInput.Category != "orders" {
		t.Fatalf("unexpected activity input: %+v", businesses.activityInput)
	}

	// A zero/negative limit falls back to the default page size.
	_, err = service.ListBusinessActivity(context.Background(), ListBusinessActivityCommand{
		ActorRole:  admindomain.RoleOperator,
		BusinessID: "business-1",
	})
	if err != nil {
		t.Fatalf("list business activity with defaults: %v", err)
	}
	if businesses.activityInput.Limit != defaultActivityPageSize {
		t.Fatalf("expected the default page size %d, got %d", defaultActivityPageSize, businesses.activityInput.Limit)
	}

	if _, err := service.ListBusinessActivity(context.Background(), ListBusinessActivityCommand{
		ActorRole:  admindomain.RoleOperator,
		BusinessID: "business-1",
		Category:   "everything",
	}); !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected an unknown category to be invalid input, got %v", err)
	}

	if _, err := service.ListBusinessActivity(context.Background(), ListBusinessActivityCommand{
		ActorRole:  admindomain.RoleOperator,
		BusinessID: "business-1",
		Offset:     -1,
	}); !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected a negative offset to be invalid input, got %v", err)
	}
}

func TestListBusinessActivityPermissionAndNotFound(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{activityErr: ports.ErrNotFound}
	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"unused"},
	)

	if _, err := service.ListBusinessActivity(context.Background(), ListBusinessActivityCommand{
		ActorRole:  admindomain.RoleSupport,
		BusinessID: "business-1",
	}); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}

	if _, err := service.ListBusinessActivity(context.Background(), ListBusinessActivityCommand{
		ActorRole:  admindomain.RoleOperator,
		BusinessID: "missing-business",
	}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected not found for an unknown business, got %v", err)
	}
}
