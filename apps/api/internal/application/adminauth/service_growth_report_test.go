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

func TestGrowthReportRequiresPermissionAndBoundsRange(t *testing.T) {
	t.Parallel()
	from := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)
	businesses := &fakeAdminBusinesses{
		growthReport: ports.AdminGrowthReportRecord{ClickCount: 42},
	}
	service, _ := newTestServiceWithBusinesses(&fakeAdminUsers{},
		&fakeAdminSessions{}, businesses, to, []common.ID{"unused"})

	record, err := service.GrowthReport(context.Background(),
		GrowthReportCommand{ActorRole: admindomain.RoleOperator, From: from, To: to})
	if err != nil || record.ClickCount != 42 ||
		!businesses.growthReportFrom.Equal(from) ||
		!businesses.growthReportTo.Equal(to) {
		t.Fatalf("unexpected growth report result: %+v / %v", record, err)
	}
	_, err = service.GrowthReport(context.Background(),
		GrowthReportCommand{ActorRole: admindomain.RoleSupport, From: from, To: to})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("support must not read growth financials: %v", err)
	}
	_, err = service.GrowthReport(context.Background(),
		GrowthReportCommand{
			ActorRole: admindomain.RoleOperator,
			From:      from,
			To:        from.AddDate(2, 0, 0),
		})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("unbounded exports must be rejected: %v", err)
	}
}
