package common

type TenantScope struct {
	BusinessID ID
}

func (scope TenantScope) IsZero() bool {
	return scope.BusinessID.IsZero()
}
