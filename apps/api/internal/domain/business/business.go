package business

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type VerificationStatus string
type OperationalStatus string
type UserRole string

const (
	VerificationStatusUnverified VerificationStatus = "unverified"
	VerificationStatusPending    VerificationStatus = "pending"
	VerificationStatusVerified   VerificationStatus = "verified"
	VerificationStatusRejected   VerificationStatus = "rejected"

	OperationalStatusActive    OperationalStatus = "active"
	OperationalStatusSuspended OperationalStatus = "suspended"

	UserRoleOwner UserRole = "owner"
	UserRoleAdmin UserRole = "admin"
	UserRoleStaff UserRole = "staff"
)

func (status VerificationStatus) Valid() bool {
	switch status {
	case VerificationStatusUnverified, VerificationStatusPending, VerificationStatusVerified, VerificationStatusRejected:
		return true
	default:
		return false
	}
}

func (status OperationalStatus) Valid() bool {
	switch status {
	case OperationalStatusActive, OperationalStatusSuspended:
		return true
	default:
		return false
	}
}

type Business struct {
	ID                 common.ID
	Name               string
	Handle             string
	PlanID             common.ID
	VerificationStatus VerificationStatus
	DefaultDeposit     common.Money
}

type User struct {
	ID           common.ID
	BusinessID   common.ID
	Email        string
	DisplayName  string
	PasswordHash string
	Role         UserRole
	IsActive     bool
}
