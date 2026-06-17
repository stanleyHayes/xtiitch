package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	itAffClickActive     = "aaaaaaaa-8888-8888-8888-888888888881"
	itAffClickPaused     = "aaaaaaaa-8888-8888-8888-888888888882"
	itAffClickRecord     = "bbbbbbbb-8888-8888-8888-888888888881"
	itAffClickCode       = "ITCLICK"
	itAffClickPausedCode = "ITPAUSED"
)

func TestRecordAffiliateClickPersistsActiveCodeWithoutRawIP(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAffiliateClickFixture(t, pool)
	defer cleanupAffiliateClickFixture(t, pool)

	record, err := NewAffiliateRepository(pool).RecordAffiliateClick(context.Background(), ports.RecordAffiliateClickInput{
		ClickID:     itAffClickRecord,
		Code:        "itclick",
		VisitorID:   "visitor-1",
		LandingURL:  "https://demo.xtiitch.test/d/agbada",
		ReferrerURL: "https://ads.test",
		UserAgent:   "Integration browser",
		IPHash:      "hashed-ip",
	})
	if err != nil {
		t.Fatalf("record affiliate click: %v", err)
	}
	if record.ClickID != common.ID(itAffClickRecord) ||
		record.AffiliateID != common.ID(itAffClickActive) ||
		record.Code != itAffClickCode {
		t.Fatalf("unexpected click record: %+v", record)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var ipHash string
		var userAgent string
		if err := tx.QueryRow(context.Background(), `
			select ip_hash, user_agent
			from affiliate_clicks
			where affiliate_click_id = $1
		`, itAffClickRecord).Scan(&ipHash, &userAgent); err != nil {
			t.Fatalf("read click: %v", err)
		}
		if ipHash != "hashed-ip" || userAgent != "Integration browser" {
			t.Fatalf("expected hashed IP and user agent, got hash=%q userAgent=%q", ipHash, userAgent)
		}
	})

	_, err = NewAffiliateRepository(pool).RecordAffiliateClick(context.Background(), ports.RecordAffiliateClickInput{
		ClickID:   "bbbbbbbb-8888-8888-8888-888888888882",
		Code:      itAffClickPausedCode,
		VisitorID: "visitor-2",
		IPHash:    "hashed-ip",
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected paused affiliate to be unavailable, got %v", err)
	}
}

func seedAffiliateClickFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAffiliateClickFixture(t, pool)

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into affiliates (
				affiliate_id,
				code,
				display_name,
				commission_model,
				commission_rate,
				status
			)
			values
				($1, $2, 'IT Click Active', 'percentage', 1000, 'active'),
				($3, $4, 'IT Click Paused', 'percentage', 1000, 'paused')
		`, itAffClickActive, itAffClickCode, itAffClickPaused, itAffClickPausedCode)
	})
}

func cleanupAffiliateClickFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from affiliates where affiliate_id = any($1)`,
			[]string{itAffClickActive, itAffClickPaused})
	})
}
