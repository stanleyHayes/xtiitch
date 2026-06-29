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
	Images               []string
	CustomisationAllowed bool
	DepositOverrideMinor *int64
	Handle               string
	Status               Status
	Sequence             int
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
