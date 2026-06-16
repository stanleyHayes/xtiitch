package delivery

import "testing"

func TestMethodValid(t *testing.T) {
	t.Parallel()

	for _, m := range []Method{MethodPickup, MethodDelivery} {
		if !m.Valid() {
			t.Fatalf("%q should be valid", m)
		}
	}
	if Method("courier-pigeon").Valid() {
		t.Fatal("an unknown method must be invalid")
	}
}

func TestStatusValidAndTerminal(t *testing.T) {
	t.Parallel()

	cases := []struct {
		status   Status
		valid    bool
		terminal bool
	}{
		{StatusPending, true, false},
		{StatusDispatched, true, false},
		{StatusCompleted, true, true},
		{StatusCancelled, true, true},
		{Status("nonsense"), false, false},
	}
	for _, tc := range cases {
		if got := tc.status.Valid(); got != tc.valid {
			t.Fatalf("%q.Valid() = %v, want %v", tc.status, got, tc.valid)
		}
		if got := tc.status.Terminal(); got != tc.terminal {
			t.Fatalf("%q.Terminal() = %v, want %v", tc.status, got, tc.terminal)
		}
	}
}

func TestNextOnAdvance(t *testing.T) {
	t.Parallel()

	cases := []struct {
		method Method
		from   Status
		want   Status
		ok     bool
	}{
		// Pickup collapses straight to completed when collected.
		{MethodPickup, StatusPending, StatusCompleted, true},
		{MethodPickup, StatusDispatched, "", false}, // a pickup is never dispatched
		{MethodPickup, StatusCompleted, "", false},
		// Delivery walks pending -> dispatched -> completed.
		{MethodDelivery, StatusPending, StatusDispatched, true},
		{MethodDelivery, StatusDispatched, StatusCompleted, true},
		{MethodDelivery, StatusCompleted, "", false},
		{MethodDelivery, StatusCancelled, "", false},
	}
	for _, tc := range cases {
		got, ok := NextOnAdvance(tc.method, tc.from)
		if got != tc.want || ok != tc.ok {
			t.Fatalf("NextOnAdvance(%q, %q) = (%q, %v), want (%q, %v)", tc.method, tc.from, got, ok, tc.want, tc.ok)
		}
	}
}

func TestCanCancel(t *testing.T) {
	t.Parallel()

	cases := map[Status]bool{
		StatusPending:    true,
		StatusDispatched: true,
		StatusCompleted:  false,
		StatusCancelled:  false,
	}
	for status, want := range cases {
		if got := CanCancel(status); got != want {
			t.Fatalf("CanCancel(%q) = %v, want %v", status, got, want)
		}
	}
}
