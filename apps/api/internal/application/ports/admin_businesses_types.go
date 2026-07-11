package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AdminBusinessRecord struct {
	BusinessID           common.ID
	Name                 string
	Handle               string
	OwnerName            string
	OwnerEmail           string
	PlanName             string
	PlanCode             string
	VerificationStatus   business.VerificationStatus
	OperationalStatus    business.OperationalStatus
	SettlementSubaccount string
	OrdersCount          int
	GMVMinor             int64
	CommissionMinor      int64
	LastActiveAt         time.Time
	CreatedAt            time.Time
	UpdatedAt            time.Time
	SuspensionReason     string
	SuspendedAt          *time.Time
	SuspendedByAdminUser common.ID
}

type AdminCustomerRecord struct {
	CustomerID         common.ID
	Email              string
	Phone              string
	DisplayName        string
	TenantCount        int
	OrderCount         int
	CustomOrderCount   int
	GMVMinor           int64
	LastBusinessName   string
	LastBusinessHandle string
	LastActiveAt       time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// AdminCustomerExportRecord is the complete picture of one customer's data held
// across the platform, assembled for a subject-access request.
type AdminCustomerExportRecord struct {
	CustomerID   common.ID
	Email        string
	Phone        string
	DisplayName  string
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Businesses   []AdminCustomerExportBusiness
	Orders       []AdminCustomerExportOrder
	Measurements []AdminCustomerExportMeasurement
}

type AdminCustomerExportBusiness struct {
	BusinessName   string
	BusinessHandle string
	FirstSeenAt    time.Time
}

type AdminCustomerExportOrder struct {
	OrderID          common.ID
	BusinessName     string
	DesignTitle      string
	OrderType        string
	Status           string
	AgreedTotalMinor int64
	CreatedAt        time.Time
}

type AdminCustomerExportMeasurement struct {
	OrderID   common.ID
	Source    string
	Values    string // raw JSON object of measurement field → value
	CreatedAt time.Time
}

// AdminCustomerErasureRecord summarises what an erasure touched.
type AdminCustomerErasureRecord struct {
	CustomerID          common.ID
	OrdersRetained      int
	MeasurementsCleared int
	BookingAddresses    int
}

type UpdateAdminBusinessStatusInput struct {
	BusinessID           common.ID
	OperationalStatus    business.OperationalStatus
	SuspensionReason     string
	SuspendedByAdminUser common.ID
}

type AdminPlatformMetricsRecord struct {
	GMVMonthMinor             int64
	PlatformRevenueMonthMinor int64
	ActiveBusinesses          int
	TotalBusinesses           int
	PendingVerifications      int
	SuspendedBusinesses       int
	PaymentHealthBPS          int
	FailedPayments30d         int
	TotalPayments30d          int
	UpdatedAt                 time.Time
}

type AdminRiskReviewRecord struct {
	ReviewKey    string
	BusinessID   common.ID
	Title        string
	BusinessName string
	Level        string
	Reason       string
	Owner        string
	Status       string
	UpdatedAt    time.Time
}

type SetAdminRiskReviewStatusInput struct {
	ReviewKey      string
	Status         string
	Reason         string
	ActorAdminUser common.ID
}

type AdminSupportTicketRecord struct {
	TicketKey           string
	BusinessID          common.ID
	Subject             string
	BusinessName        string
	Priority            string
	Summary             string
	Category            string
	Status              string
	AssignedAdminUserID common.ID
	AssignedAdminEmail  string
	AssignedAdminName   string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type UpdateAdminSupportTicketInput struct {
	TicketKey      string
	Status         string
	Assignment     string
	Note           string
	ActorAdminUser common.ID
}
