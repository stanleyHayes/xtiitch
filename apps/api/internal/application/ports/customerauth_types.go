package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// CustomerOTPChannel names the medium a one-time code is sent over. Customers
// can sign in by phone (WhatsApp) or by email; the challenge stores which.
type CustomerOTPChannel string

const (
	CustomerOTPChannelWhatsApp CustomerOTPChannel = "whatsapp"
	CustomerOTPChannelEmail    CustomerOTPChannel = "email"
)

type CustomerOrderSummary struct {
	OrderID          common.ID
	BusinessName     string
	BusinessHandle   string
	DesignTitle      string
	Status           string
	AgreedTotalMinor int64
	CreatedAt        time.Time
}

type CustomerProfile struct {
	CustomerID    common.ID
	DisplayName   string
	Phone         string
	Email         string
	WhatsAppPhone string
}

type CreateOTPChallengeInput struct {
	ChallengeID common.ID
	Channel     CustomerOTPChannel
	Phone       string
	Email       string
	CodeHash    string
	ExpiresAt   time.Time
}

type OTPChallengeRecord struct {
	ChallengeID common.ID
	Channel     CustomerOTPChannel
	Phone       string
	Email       string
	CodeHash    string
	Attempts    int
	ExpiresAt   time.Time
}

type CustomerAccessTokenInput struct {
	CustomerID common.ID
	Phone      string
	IssuedAt   time.Time
	ExpiresAt  time.Time
}

type VerifiedCustomerToken struct {
	CustomerID common.ID
	Phone      string
}
