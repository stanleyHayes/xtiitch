package ports

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// StageTemplate is one production stage in a business's flow (a board column).
type StageTemplate struct {
	Name     string
	Colour   string
	Flow     string
	Sequence int
}

// OrderBilling is the slice of an order a balance charge reasons about.
type OrderBilling struct {
	OrderType        string
	Status           string
	AgreedTotalMinor *int64
	SettledMinor     int64
	CustomerEmail    string
	// BalanceInFlight is true when an initiated balance payment already exists
	// for the order, so a second balance charge must be refused.
	BalanceInFlight bool
}

type CreateWalkInOrderInput struct {
	OrderID          common.ID
	BusinessID       common.ID
	CustomerID       common.ID
	DesignID         common.ID
	SizeBandID       *common.ID
	CustomerName     string
	CustomerPhone    string
	CustomerWhatsApp string
	CustomerEmail    string
	AgreedTotalMinor *int64
}

type CreateOnlineOrderInput struct {
	OrderID          common.ID
	BusinessID       common.ID
	CustomerID       common.ID
	DesignID         common.ID
	SizeBandID       *common.ID
	CustomerName     string
	CustomerPhone    string
	CustomerWhatsApp string
	CustomerEmail    string
	AgreedTotalMinor int64
	// CheckoutGroupID links this order to the other orders paid by one combined
	// cart charge. Nil for a stand-alone order.
	CheckoutGroupID *common.ID
	// Delivery snapshot, set only when the customer chose delivery at checkout.
	// For a combined cart the snapshot rides the anchor order (the fee is added to
	// the cart total once). DeliveryMethod is "" for the default (no handover yet).
	DeliveryMethod   string
	DeliveryAddress  string
	DeliveryFeeMinor int64
	DeliveryZoneID   *common.ID
	// Note is the customer's free-text instruction captured at checkout ('' if none).
	Note string
}

type CreateCustomOrderInput struct {
	OrderID          common.ID
	BusinessID       common.ID
	CustomerID       common.ID
	DesignID         common.ID
	SizeMode         string
	CustomerName     string
	CustomerPhone    string
	CustomerWhatsApp string
	CustomerEmail    string
	// AgreedTotalMinor is normally nil for standalone bespoke deposit flows
	// because the final total is negotiated later. Cart checkout sets it to the
	// deposit paid by this line so the checkout-group webhook can settle the
	// order by its own line amount.
	AgreedTotalMinor *int64
	// CheckoutGroupID links a bespoke deposit line to a mixed cart checkout.
	// Nil for bespoke orders placed from their standalone product-page flow.
	CheckoutGroupID *common.ID
	// MeasurementID and Measurements are set only for the self-measure route;
	// Measurements maps the business's measurement field ids to entered values.
	MeasurementID common.ID
	Measurements  map[string]string
	// Note is the customer's free-text instruction captured at checkout ('' if none).
	Note string
}

type CreateCustomOrderConfirmedInput struct {
	OrderID          common.ID
	BusinessID       common.ID
	CustomerID       common.ID
	DesignID         common.ID
	SizeMode         string
	CustomerName     string
	CustomerPhone    string
	CustomerWhatsApp string
	CustomerEmail    string
	// Channel records where the order came from: "online" (customer chose
	// come-to-shop at online checkout) or "walk_in" (staff logged it in person).
	// Empty defaults to "online" for back-compatibility.
	Channel string
	// MeasurementID and Measurements are set when staff captured the customer's
	// measurements at the counter; Measurements maps the business's measurement
	// field ids to entered values. Stored against the order with source 'shop'.
	MeasurementID common.ID
	Measurements  map[string]string
}

type OrderSummary struct {
	OrderID          common.ID
	DesignTitle      string
	CustomerName     string
	CustomerPhone    string
	CustomerWhatsApp string
	CustomerEmail    string
	Status           string
	OrderType        string
	SizeMode         string
	Channel          string
	StageName        string
	Colour           string
	AgreedTotalMinor *int64
	SettledMinor     int64
	PaymentStatus    string
	PaymentPurpose   string
	PaymentAmount    *int64
	CreatedAt        time.Time
}
