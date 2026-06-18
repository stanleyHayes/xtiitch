package growthapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestRecordAffiliateClickNormalizesAndHashesInput(t *testing.T) {
	t.Parallel()

	repo := &fakeAffiliateClicks{}
	service := NewService(Dependencies{
		Affiliates: repo,
		IDs:        sequenceIDs{ids: []common.ID{"click-1"}},
	})

	record, err := service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code:        " sewing-pro ",
		VisitorID:   " visitor-1 ",
		LandingURL:  " https://demo.xtiitch.test/d/agbada ",
		ReferrerURL: " https://example.com/ad ",
		UserAgent:   "Test browser",
		IPAddress:   "203.0.113.10",
	})
	if err != nil {
		t.Fatalf("record affiliate click: %v", err)
	}
	if repo.input.ClickID != "click-1" ||
		repo.input.Code != "SEWING-PRO" ||
		repo.input.VisitorID != "visitor-1" ||
		repo.input.IPHash == "" ||
		repo.input.IPHash == "203.0.113.10" {
		t.Fatalf("expected normalized hashed input, got %+v", repo.input)
	}
	if record.Code != "SEWING-PRO" || record.ClickID != "click-1" {
		t.Fatalf("unexpected click response: %+v", record)
	}
}

func TestRecordAffiliateClickRequiresIdentifierAndKnownAffiliate(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{
		Affiliates: &fakeAffiliateClicks{err: ports.ErrNotFound},
		IDs:        sequenceIDs{ids: []common.ID{"click-1"}},
	})

	_, err := service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code: "bad code!",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid code, got %v", err)
	}

	_, err = service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code: "SEWINGPRO",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected missing visitor/ip to be invalid, got %v", err)
	}

	_, err = service.RecordAffiliateClick(context.Background(), RecordAffiliateClickCommand{
		Code:      "SEWINGPRO",
		IPAddress: "203.0.113.10",
	})
	if !errors.Is(err, ErrAffiliateNotFound) {
		t.Fatalf("expected unknown affiliate mapping, got %v", err)
	}
}

type fakeAffiliateClicks struct {
	input ports.RecordAffiliateClickInput
	err   error
}

func (repo *fakeAffiliateClicks) RecordAffiliateClick(
	_ context.Context,
	input ports.RecordAffiliateClickInput,
) (ports.AffiliateClickRecord, error) {
	repo.input = input
	if repo.err != nil {
		return ports.AffiliateClickRecord{}, repo.err
	}
	return ports.AffiliateClickRecord{
		ClickID:     input.ClickID,
		AffiliateID: "affiliate-1",
		Code:        input.Code,
		ClickedAt:   time.Now(),
	}, nil
}

func (repo *fakeAffiliateClicks) ReserveAffiliateAttribution(
	context.Context,
	common.TenantScope,
	ports.ReserveAffiliateAttributionInput,
) (ports.AffiliateAttributionReservation, error) {
	return ports.AffiliateAttributionReservation{}, nil
}

type sequenceIDs struct {
	ids []common.ID
}

func (seq sequenceIDs) NewID() common.ID {
	if len(seq.ids) == 0 {
		return "generated"
	}
	return seq.ids[0]
}
