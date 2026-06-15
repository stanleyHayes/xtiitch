package order

import "testing"

func TestClassify(t *testing.T) {
	t.Parallel()

	cases := []struct {
		mode       SizeMode
		customised bool
		want       Type
	}{
		{SizeModeBand, false, TypeStandard},
		{SizeModeBand, true, TypeCustom},
		{SizeModeSelfMeasure, false, TypeCustom},
		{SizeModeHomeVisit, false, TypeCustom},
		{SizeModeComeToShop, false, TypeCustom},
	}
	for _, tc := range cases {
		if got := Classify(tc.mode, tc.customised); got != tc.want {
			t.Fatalf("Classify(%q, %v) = %q, want %q", tc.mode, tc.customised, got, tc.want)
		}
	}
}

func TestTypeFlow(t *testing.T) {
	t.Parallel()

	if TypeStandard.Flow() != FlowReadyMade {
		t.Fatal("standard orders run the ready-made flow")
	}
	if TypeCustom.Flow() != FlowBespoke {
		t.Fatal("custom orders run the bespoke flow")
	}
}

func TestSizeModeHelpers(t *testing.T) {
	t.Parallel()

	cases := []struct {
		mode            SizeMode
		valid           bool
		custom          bool
		takesDeposit    bool
		capturesMeasure bool
	}{
		{SizeModeBand, true, false, false, false},
		{SizeModeSelfMeasure, true, true, true, true},
		{SizeModeHomeVisit, true, true, true, false},
		{SizeModeComeToShop, true, true, false, false},
		{SizeMode("nonsense"), false, false, false, false},
	}
	for _, tc := range cases {
		if got := tc.mode.Valid(); got != tc.valid {
			t.Fatalf("%q.Valid() = %v, want %v", tc.mode, got, tc.valid)
		}
		if got := tc.mode.IsCustomRoute(); got != tc.custom {
			t.Fatalf("%q.IsCustomRoute() = %v, want %v", tc.mode, got, tc.custom)
		}
		if got := RouteTakesDeposit(tc.mode); got != tc.takesDeposit {
			t.Fatalf("RouteTakesDeposit(%q) = %v, want %v", tc.mode, got, tc.takesDeposit)
		}
		if got := RouteCapturesMeasurement(tc.mode); got != tc.capturesMeasure {
			t.Fatalf("RouteCapturesMeasurement(%q) = %v, want %v", tc.mode, got, tc.capturesMeasure)
		}
	}
}
