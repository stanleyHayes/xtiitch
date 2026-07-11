package cataloguehttp

type sizeChartItemBody struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Unit  string `json:"unit"`
}

type sizeBandBody struct {
	Label    string              `json:"label"`
	Chart    []sizeChartItemBody `json:"chart"`
	Sequence int                 `json:"sequence"`
}

// sizeBandOverrideBody is the PUT payload. Both fields are optional pointers so an
// absent key means "leave the master value in place": a nil label keeps the master
// label; a nil chart keeps the master chart (a present chart, even [], overrides).
type sizeBandOverrideBody struct {
	Label *string              `json:"label"`
	Chart *[]sizeChartItemBody `json:"chart"`
}

type sizeBandOverrideResponse struct {
	SizeBandID string              `json:"size_band_id"`
	Label      *string             `json:"label"`
	Chart      []sizeChartItemBody `json:"chart"`
	ChartSet   bool                `json:"chart_set"`
}

type variationBody struct {
	Name      string   `json:"name"`
	Images    []string `json:"images"`
	IsDefault bool     `json:"is_default"`
	Sequence  int      `json:"sequence"`
}

type reorderVariationsBody struct {
	OrderedIDs []string `json:"ordered_ids"`
}
