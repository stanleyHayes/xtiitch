package adminauth

import (
	"context"
	"net/mail"
	"net/url"
	"strconv"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func normalizeOperatorNote(value string) string {
	note := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(note)
	if len(runes) > 600 {
		return string(runes[:600])
	}
	return note
}

func (s Service) adminSubscriptionByBusiness(
	ctx context.Context,
	businessID common.ID,
) (ports.AdminSubscriptionRecord, error) {
	records, err := s.businesses.ListAdminSubscriptions(ctx)
	if err != nil {
		return ports.AdminSubscriptionRecord{}, err
	}
	for _, record := range records {
		if record.BusinessID == businessID {
			return record, nil
		}
	}
	return ports.AdminSubscriptionRecord{}, ports.ErrNotFound
}

func normalizeEmail(value string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}

	return strings.ToLower(parsed.Address), nil
}

func (s Service) authorizePermission(
	ctx context.Context,
	role admindomain.Role,
	permission admindomain.Permission,
) error {
	permissions, err := s.permissionsForRole(ctx, role)
	if err != nil {
		return err
	}
	for _, candidate := range permissions {
		if candidate == permission {
			return nil
		}
	}
	return authdomain.ErrForbidden
}

func (s Service) permissionsForRole(ctx context.Context, role admindomain.Role) ([]admindomain.Permission, error) {
	records, err := s.ListRolePermissions(ctx)
	if err != nil {
		return nil, err
	}
	for _, record := range records {
		if record.Role == role {
			return record.Permissions, nil
		}
	}
	return nil, authdomain.ErrForbidden
}

func normalizeRolePermissionRecords(records []ports.AdminRolePermissionsRecord) ([]ports.AdminRolePermissionsRecord, error) {
	byRole := make(map[admindomain.Role][]admindomain.Permission, len(admindomain.RoleCatalog()))
	for _, record := range records {
		if !record.Role.Valid() {
			return nil, authdomain.ErrInvalidInput
		}
		byRole[record.Role] = append(byRole[record.Role], record.Permissions...)
	}

	out := make([]ports.AdminRolePermissionsRecord, 0, len(admindomain.RoleCatalog()))
	for _, role := range admindomain.RoleCatalog() {
		permissions, err := normalizePermissionSet(role, byRole[role])
		if err != nil {
			return nil, err
		}
		out = append(out, ports.AdminRolePermissionsRecord{
			Role:        role,
			Permissions: permissions,
		})
	}

	return out, nil
}

func normalizePermissionSet(
	role admindomain.Role,
	permissions []admindomain.Permission,
) ([]admindomain.Permission, error) {
	if !role.Valid() {
		return nil, authdomain.ErrInvalidInput
	}

	selected := make(map[admindomain.Permission]bool, len(permissions))
	for _, permission := range permissions {
		if !permission.Valid() {
			return nil, authdomain.ErrInvalidInput
		}
		selected[permission] = true
	}

	if role == admindomain.RoleOwner {
		for _, permission := range requiredOwnerPermissions() {
			if !selected[permission] {
				return nil, authdomain.ErrInvalidInput
			}
		}
	}

	out := make([]admindomain.Permission, 0, len(selected))
	for _, permission := range admindomain.PermissionCatalog() {
		if selected[permission] {
			out = append(out, permission)
		}
	}
	return out, nil
}

func requiredOwnerPermissions() []admindomain.Permission {
	return []admindomain.Permission{
		admindomain.PermissionManageAdminUsers,
		admindomain.PermissionManageRoles,
	}
}

func subscriptionOverDesignLimit(subscription ports.AdminSubscriptionRecord) bool {
	return subscription.DesignLimit != nil && subscription.DesignCount > *subscription.DesignLimit
}

func normalizePaymentURL(value string) (string, error) {
	trimmed := normalizeOperatorNote(value)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return "", authdomain.ErrInvalidInput
	}
	return trimmed, nil
}

func copyOptionalInt(value *int) *int {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func boolString(value bool) string {
	return strconv.FormatBool(value)
}

func intString(value int) string {
	return strconv.Itoa(value)
}

func intString64(value int64) string {
	return strconv.FormatInt(value, 10)
}

func moneySummary(value int64) string {
	return "GHS " + strconv.FormatFloat(float64(value)/100, 'f', 2, 64)
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func optionalIDMetadata(value *common.ID) string {
	if value == nil {
		return ""
	}
	return value.String()
}

func permissionsString(permissions []admindomain.Permission) string {
	out := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		out = append(out, string(permission))
	}
	return strings.Join(out, ",")
}
