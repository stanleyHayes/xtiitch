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
