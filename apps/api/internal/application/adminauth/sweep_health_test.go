package adminauth

import (
	"testing"
	"time"
)

// The whole point of recording sweep runs is that a sweep which quietly stops
// firing becomes visible. Staleness is the only symptom it has: the worker logs
// failures rather than throwing, so nothing else ever reports it.
func TestSweepStaleAfterToleratesOneMissedDailyRun(t *testing.T) {
	// The slowest sweep on the schedule is daily. The window must clear a single
	// missed run plus drift, or the console cries wolf every time a run is late.
	if sweepStaleAfter <= 24*time.Hour {
		t.Fatalf("sweepStaleAfter = %s, would alarm on one late daily run", sweepStaleAfter)
	}
	// But it must still be short enough that a stopped sweep is caught in days,
	// not the week it previously took someone noticing the money stopped moving.
	if sweepStaleAfter > 72*time.Hour {
		t.Fatalf("sweepStaleAfter = %s, too slow to catch a stopped sweep", sweepStaleAfter)
	}
}

func TestHumanAgoReadsTheWayAnOperatorReads(t *testing.T) {
	for _, tc := range []struct {
		in   time.Duration
		want string
	}{
		{30 * time.Minute, "30m ago"},
		{5 * time.Hour, "5h ago"},
		{47 * time.Hour, "47h ago"},
		{72 * time.Hour, "3d ago"},
		{8 * 24 * time.Hour, "8d ago"},
	} {
		if got := humanAgo(tc.in); got != tc.want {
			t.Fatalf("humanAgo(%s) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
