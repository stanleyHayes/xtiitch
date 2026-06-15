package order

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

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
}
