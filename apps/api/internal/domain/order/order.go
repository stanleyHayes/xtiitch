package order

import (
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Status string

const (
	StatusDraft           Status = "draft"
	StatusAwaitingDeposit Status = "awaiting_deposit"
	StatusConfirmed       Status = "confirmed"
	StatusFulfilled       Status = "fulfilled"
	StatusCancelled       Status = "cancelled"
)

type Type string

const (
	TypeStandard Type = "standard"
	TypeCustom   Type = "custom"
)

type SizeMode string

const (
	SizeModeBand        SizeMode = "band"
	SizeModeSelfMeasure SizeMode = "self_measure"
	SizeModeHomeVisit   SizeMode = "home_visit"
	SizeModeComeToShop  SizeMode = "come_to_shop"
)

// Valid reports whether the size mode is one the system knows.
func (m SizeMode) Valid() bool {
	switch m {
	case SizeModeBand, SizeModeSelfMeasure, SizeModeHomeVisit, SizeModeComeToShop:
		return true
	default:
		return false
	}
}

// IsCustomRoute reports whether the size mode is one of the three custom-order
// measurement routes (i.e. anything other than fitting a listed band).
func (m SizeMode) IsCustomRoute() bool {
	switch m {
	case SizeModeSelfMeasure, SizeModeHomeVisit, SizeModeComeToShop:
		return true
	default:
		return false
	}
}

// RouteTakesDeposit reports whether placing a custom order through this route
// raises a deposit online. Self-measure and home-visit do; come-to-shop arranges
// everything in person and takes no online payment (Spec 8.1, 8.3).
func RouteTakesDeposit(m SizeMode) bool {
	return m == SizeModeSelfMeasure || m == SizeModeHomeVisit
}

// RouteCapturesMeasurement reports whether the customer supplies measurements at
// checkout. Only self-measure does; the other routes capture them later, in
// person.
func RouteCapturesMeasurement(m SizeMode) bool {
	return m == SizeModeSelfMeasure
}

type Flow string

const (
	FlowReadyMade Flow = "ready_made"
	FlowBespoke   Flow = "bespoke"
)

// Colour is the customer-facing tracking signal — primary data, never just
// decoration (Spec 16.6).
type Colour string

const (
	ColourRed    Colour = "red"
	ColourYellow Colour = "yellow"
	ColourGreen  Colour = "green"
)

// Classify derives the order type: standard when the customer fits a listed
// band and takes the design as shown; custom otherwise (Spec 8.1).
func Classify(mode SizeMode, customised bool) Type {
	if mode == SizeModeBand && !customised {
		return TypeStandard
	}
	return TypeCustom
}

// Flow returns the production flow an order type runs through.
func (t Type) Flow() Flow {
	if t == TypeStandard {
		return FlowReadyMade
	}
	return FlowBespoke
}

type Order struct {
	ID               common.ID
	BusinessID       common.ID
	CustomerID       common.ID
	DesignID         common.ID
	SizeBandID       *common.ID
	Type             Type
	SizeMode         SizeMode
	Flow             Flow
	Channel          string
	Status           Status
	AgreedTotalMinor *int64
	SettledMinor     int64
	CurrentStageID   *common.ID
}

// Stage is one production step the business defines, tied to a colour.
type Stage struct {
	ID         common.ID
	Name       string
	Colour     Colour
	Flow       Flow
	Sequence   int
	IsCurrent  bool
	IsComplete bool
}

// Tracking is the customer's "where is my cloth?" view of one order.
type Tracking struct {
	OrderID     common.ID
	DesignTitle string
	StoreName   string
	Status      Status
	StageName   string
	Colour      Colour
	Stages      []Stage
	Handover    *HandoverTracking
}

// HandoverTracking is the customer-safe last-leg status attached to an order's
// public tracking page once pickup or delivery has been arranged.
type HandoverTracking struct {
	Method         string
	Status         string
	RecipientName  string
	RecipientPhone string
	Address        string
	Courier        string
	Note           string
	UpdatedAt      time.Time
}
