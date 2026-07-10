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
		KindOrderStageAdvanced,
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

func TestStageAdvanceReferenceDedupesPerStage(t *testing.T) {
	t.Parallel()

	// Each stage an order reaches fires its own message; re-advancing to the same
	// stage dedupes, but different stages of the same order do not collide.
	stageA := DedupKey(KindOrderStageAdvanced, StageAdvanceReference("order-1", "stage-a"))
	stageB := DedupKey(KindOrderStageAdvanced, StageAdvanceReference("order-1", "stage-b"))
	if stageA == stageB {
		t.Fatal("different stages of the same order must not collide")
	}
	if stageA != DedupKey(KindOrderStageAdvanced, StageAdvanceReference("order-1", "stage-a")) {
		t.Fatal("the same order+stage must produce a stable dedup key")
	}
	if stageA == DedupKey(KindOrderStageAdvanced, StageAdvanceReference("order-2", "stage-a")) {
		t.Fatal("the same stage for different orders must not collide")
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
