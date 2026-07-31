package adminauth

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

type GrowthReportCommand struct {
	ActorRole admindomain.Role
	From      time.Time
	To        time.Time
}

func (s Service) GrowthReport(ctx context.Context, cmd GrowthReportCommand) (ports.AdminGrowthReportRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole,
		admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminGrowthReportRecord{}, err
	}
	if s.businesses == nil || !cmd.From.Before(cmd.To) ||
		cmd.To.Sub(cmd.From) > 366*24*time.Hour {
		return ports.AdminGrowthReportRecord{}, authdomain.ErrInvalidInput
	}
	return s.businesses.GetAdminGrowthReport(ctx, cmd.From, cmd.To)
}
