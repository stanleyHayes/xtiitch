package notification

import "testing"

func TestChannelValid(t *testing.T) {
	t.Parallel()

	for _, c := range []Channel{ChannelWhatsApp, ChannelSMS} {
		if !c.Valid() {
			t.Fatalf("%q should be valid", c)
		}
	}
	if Channel("fax").Valid() {
		t.Fatal("an unknown channel must be invalid")
	}
}

func TestKindValid(t *testing.T) {
	t.Parallel()

	for _, k := range []Kind{
		KindOrderConfirmed,
		KindOrderFulfilled,
		KindBookingConfirmed,
		KindBalancePaid,
		KindHandoverDispatched,
		KindHandoverCompleted,
	} {
		if !k.Valid() {
			t.Fatalf("%q should be valid", k)
		}
	}
	if Kind("order_vibes").Valid() {
		t.Fatal("an unknown kind must be invalid")
	}
}

func TestDedupKey(t *testing.T) {
	t.Parallel()

	// One kind fires at most once per reference; different kinds / references
	// never collide.
	if got := DedupKey(KindOrderConfirmed, "order-1"); got != "order_confirmed:order-1" {
		t.Fatalf("unexpected dedup key: %q", got)
	}
	if DedupKey(KindOrderConfirmed, "order-1") == DedupKey(KindOrderFulfilled, "order-1") {
		t.Fatal("different kinds for the same order must not collide")
	}
	if DedupKey(KindOrderConfirmed, "order-1") == DedupKey(KindOrderConfirmed, "order-2") {
		t.Fatal("the same kind for different orders must not collide")
	}
}
