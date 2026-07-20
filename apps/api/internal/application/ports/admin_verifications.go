package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminVerificationCaseRecord struct {
	BusinessID            common.ID
	BusinessName          string
	Handle                string
	OwnerName             string
	OwnerEmail            string
	PlanName              string
	PlanCode              string
	VerificationStatus    business.VerificationStatus
	SettlementProvider    string
	SettlementSubaccount  string
	SettlementAccountHint string
	// Ghana Card identity document the business submitted for review (empty when
	// none submitted yet). FullLegalName is the owner's name exactly as printed
	// on the card (§2.3); empty for submissions that predate migration 000097.
	FullLegalName  string
	IDCardNumber   string
	IDPhotoURL     string
	IDPhotoBackURL string
	SubmittedAt    time.Time
	UpdatedAt      time.Time
}
type AdminBusinessVerificationDecisionInput struct {
	BusinessID common.ID
	Status     business.VerificationStatus
}
