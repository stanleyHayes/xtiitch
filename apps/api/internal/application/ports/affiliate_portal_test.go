package ports

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestPartnerReferralRecordJSONIsPrivacyMinimal(t *testing.T) {
	payload, err := json.Marshal(PartnerReferralRecord{Handle: "amaatelier", Status: "active"})
	if err != nil {
		t.Fatal(err)
	}

	var fields map[string]any
	if err := json.Unmarshal(payload, &fields); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{"handle": "amaatelier", "status": "active"}
	if !reflect.DeepEqual(fields, want) {
		t.Fatalf("referral API record must expose only handle and status: got %#v", fields)
	}
}
