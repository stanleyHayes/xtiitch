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
	Sequence   int
}

type BandPrice struct {
	SizeBandID common.ID
	Label      string
	PriceMinor int64
}
