package admin

type Role string

type Permission string

type AuditSeverity string

const (
	RoleOwner    Role = "owner"
	RoleOperator Role = "operator"
	RoleSupport  Role = "support"
)

const (
	PermissionManageAdminUsers    Permission = "manage_admin_users"
	PermissionManageRoles         Permission = "manage_roles"
	PermissionManageSettings      Permission = "manage_settings"
	PermissionReviewBusinesses    Permission = "review_businesses"
	PermissionManageMoneyRails    Permission = "manage_money_rails"
	PermissionManageSubscriptions Permission = "manage_subscriptions"
	PermissionManagePlans         Permission = "manage_plans"
	PermissionManagePromotions    Permission = "manage_promotions"
	PermissionManageAds           Permission = "manage_ads"
	PermissionManageRisk          Permission = "manage_risk"
	PermissionManageSupport       Permission = "manage_support"
	PermissionViewAudit           Permission = "view_audit"
)

const (
	AuditSeverityInfo     AuditSeverity = "info"
	AuditSeverityWarning  AuditSeverity = "warning"
	AuditSeverityCritical AuditSeverity = "critical"
)

func (role Role) Valid() bool {
	switch role {
	case RoleOwner, RoleOperator, RoleSupport:
		return true
	default:
		return false
	}
}

func (role Role) Permissions() []Permission {
	switch role {
	case RoleOwner:
		return []Permission{
			PermissionManageAdminUsers,
			PermissionManageRoles,
			PermissionManageSettings,
			PermissionReviewBusinesses,
			PermissionManageMoneyRails,
			PermissionManageSubscriptions,
			PermissionManagePlans,
			PermissionManagePromotions,
			PermissionManageAds,
			PermissionManageRisk,
			PermissionManageSupport,
			PermissionViewAudit,
		}
	case RoleOperator:
		return []Permission{
			PermissionReviewBusinesses,
			PermissionManageMoneyRails,
			PermissionManageSubscriptions,
			PermissionManagePlans,
			PermissionManagePromotions,
			PermissionManageAds,
			PermissionManageRisk,
			PermissionManageSupport,
			PermissionViewAudit,
		}
	case RoleSupport:
		return []Permission{
			PermissionManageSupport,
			PermissionViewAudit,
		}
	default:
		return nil
	}
}

func (permission Permission) Valid() bool {
	for _, candidate := range PermissionCatalog() {
		if permission == candidate {
			return true
		}
	}
	return false
}

func (severity AuditSeverity) Valid() bool {
	switch severity {
	case AuditSeverityInfo, AuditSeverityWarning, AuditSeverityCritical:
		return true
	default:
		return false
	}
}

func RoleCatalog() []Role {
	return []Role{RoleOwner, RoleOperator, RoleSupport}
}

func PermissionCatalog() []Permission {
	return []Permission{
		PermissionManageAdminUsers,
		PermissionManageRoles,
		PermissionManageSettings,
		PermissionReviewBusinesses,
		PermissionManageMoneyRails,
		PermissionManageSubscriptions,
		PermissionManagePlans,
		PermissionManagePromotions,
		PermissionManageAds,
		PermissionManageRisk,
		PermissionManageSupport,
		PermissionViewAudit,
	}
}
