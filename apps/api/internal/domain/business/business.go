package business

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type VerificationStatus string

const (
	VerificationStatusUnverified VerificationStatus = "unverified"
	VerificationStatusPending    VerificationStatus = "pending"
	VerificationStatusVerified   VerificationStatus = "verified"
	VerificationStatusRejected   VerificationStatus = "rejected"
)

type Business struct {
	ID                 common.ID
	Name               string
	Handle             string
	PlanID             common.ID
	VerificationStatus VerificationStatus
	DefaultDeposit     common.Money
}
