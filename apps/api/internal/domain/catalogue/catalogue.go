package catalogue

import "github.com/xcreativs/xtiitch/apps/api/internal/domain/common"

type Collection struct {
	ID         common.ID
	BusinessID common.ID
	Name       string
	Theme      string
	Handle     string
	Status     Status
	Sequence   int
}

type Design struct {
	ID                   common.ID
	BusinessID           common.ID
	CollectionID         *common.ID
	Title                string
	Description          string
	StyleCategory        string
	Images               []string
	CustomisationAllowed bool
	DepositOverrideMinor *int64
	Handle               string
	Status               Status
	Sequence             int
	// BespokeDisplayMinor is the indicative/shown price for a bespoke (custom)
	// order, in GHS pesewas, distinct from the deposit that is actually collected
	// (DepositOverrideMinor). 0 means unset / not shown. Only meaningful on a
	// customisation design; coerced to 0 otherwise.
	BespokeDisplayMinor int64
	// Variations are the design's stored colour variations (each a colour name +
	// an ordered image set). The design itself is the implicit default variation,
	// so this holds only the ADDITIONAL colour-labelled sets. Empty on list reads;
	// populated on the single-design dashboard and public storefront reads.
	Variations []DesignVariation
}

// DesignVariation is one stored colour variation of a design: a colour name and
// an ordered list of images. It shares the design's price and order flow and
// only adds a colour-labelled image set. The design itself is the implicit
// default (first) variation, so a stored row is normally a non-default extra.
type DesignVariation struct {
	ID         common.ID
	DesignID   common.ID
	BusinessID common.ID
	Name       string
	Images     []string
	IsDefault  bool
	Sequence   int
}

// VariationCreateAllowed reports whether a business may store one more colour
// variation for a design that already has existingStored rows, given its plan's
// cap. The design's implicit default occupies one slot, so a new row is allowed
// only while the stored count plus that default stays below the cap.
//
// cap is the plan's variation_limit; nil means unlimited. It used to be derived
// from the plan CODE by a hardcoded switch (Free 2 / Starter 3 / Growth 5 /
// Studio 10), which an admin could not change without a deploy and which gave
// any unrecognised plan code the most restrictive cap. The numbers now live in
// the plan, so only the rule -- that the default takes a slot -- stays here.
func VariationCreateAllowed(cap *int, existingStored int) bool {
	if cap == nil {
		return true
	}
	return existingStored+1 < *cap
}

type SizeBand struct {
	ID         common.ID
	BusinessID common.ID
	Label      string
	// Chart is the size band's detailed measurement chart — an ordered list of
	// {name, value, unit} entries (e.g. {"Bust", "36", "inches"}). Empty when the
	// owner has not defined one. Surfaced to customers on the storefront and
	// mirrored in the dashboard measurements view.
	Chart    []SizeChartItem
	Sequence int
}

// SizeChartItem is one measurement entry on a size band's chart.
type SizeChartItem struct {
	Name  string
	Value string
	Unit  string
}

// SizeChartUnits is the allowed unit vocabulary for size-chart entries. The
// dashboard offers these in a dropdown; the API validates against them.
var SizeChartUnits = []string{"cm", "in", "inches", "mm", "m", "ft"}

// ValidSizeChartUnit reports whether unit is an allowed size-chart unit.
func ValidSizeChartUnit(unit string) bool {
	for _, u := range SizeChartUnits {
		if u == unit {
			return true
		}
	}
	return false
}

type BandPrice struct {
	SizeBandID common.ID
	Label      string
	PriceMinor int64
	// Chart is the size band's measurement chart, surfaced to customers on the
	// storefront alongside the price. Empty when the band has no chart, or when
	// loaded from a context that does not need it (e.g. the dashboard price board).
	Chart []SizeChartItem
}

// DesignSizeBandOverride is a single design's override of one master size band's
// label and/or chart (Xtiitch-Updates §1a/§6). It is scoped to exactly one
// (design, size band): it never affects the master band or any other design. A
// nil Label inherits the master band's label; ChartSet==false inherits the master
// band's chart (ChartSet==true overrides it, even with an empty Chart).
type DesignSizeBandOverride struct {
	OverrideID common.ID
	DesignID   common.ID
	BusinessID common.ID
	SizeBandID common.ID
	Label      *string
	Chart      []SizeChartItem
	ChartSet   bool
}

// ApplyBandOverrides resolves the EFFECTIVE label/chart for a design's priced size
// bands by layering the design's overrides on top of the master band values:
// override wins per field, master otherwise. It returns a new slice and never
// mutates the input prices. Overrides that match no priced band are ignored.
func ApplyBandOverrides(prices []BandPrice, overrides []DesignSizeBandOverride) []BandPrice {
	if len(prices) == 0 || len(overrides) == 0 {
		return prices
	}
	byBand := make(map[common.ID]DesignSizeBandOverride, len(overrides))
	for _, override := range overrides {
		byBand[override.SizeBandID] = override
	}
	resolved := make([]BandPrice, len(prices))
	copy(resolved, prices)
	for i := range resolved {
		override, ok := byBand[resolved[i].SizeBandID]
		if !ok {
			continue
		}
		if override.Label != nil {
			resolved[i].Label = *override.Label
		}
		if override.ChartSet {
			resolved[i].Chart = override.Chart
		}
	}
	return resolved
}
