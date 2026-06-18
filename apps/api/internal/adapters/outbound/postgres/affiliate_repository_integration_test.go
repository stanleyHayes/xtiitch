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

	itAffReserveBusiness    = "aaaaaaaa-9999-9999-9999-999999999981"
	itAffReserveCustomer    = "aaaaaaaa-9999-9999-9999-999999999982"
	itAffReserveDesign      = "aaaaaaaa-9999-9999-9999-999999999983"
	itAffReserveOrder       = "aaaaaaaa-9999-9999-9999-999999999984"
	itAffReserveAffiliate   = "aaaaaaaa-9999-9999-9999-999999999985"
	itAffReserveClick       = "aaaaaaaa-9999-9999-9999-999999999986"
	itAffReserveReservation = "aaaaaaaa-9999-9999-9999-999999999987"
	itAffReserveCode        = "ITRESERVE"
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

func TestReserveAffiliateAttributionPersistsLastClickReservation(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAffiliateReservationFixture(t, pool)
	defer cleanupAffiliateReservationFixture(t, pool)

	record, err := NewAffiliateRepository(pool).ReserveAffiliateAttribution(
		context.Background(),
		common.TenantScope{BusinessID: itAffReserveBusiness},
		ports.ReserveAffiliateAttributionInput{
			ReservationID: itAffReserveReservation,
			BusinessID:    itAffReserveBusiness,
			OrderID:       itAffReserveOrder,
			Code:          "itreserve",
			VisitorID:     "reserve-visitor",
			GrossMinor:    50000,
		},
	)
	if err != nil {
		t.Fatalf("reserve affiliate attribution: %v", err)
	}
	if record.ReservationID != common.ID(itAffReserveReservation) ||
		record.AffiliateID != common.ID(itAffReserveAffiliate) ||
		record.BusinessID != common.ID(itAffReserveBusiness) ||
		record.OrderID != common.ID(itAffReserveOrder) ||
		record.GrossMinor != 50000 ||
		record.CommissionMinor != 7500 {
		t.Fatalf("unexpected reservation: %+v", record)
	}
	if record.AffiliateClickID == nil || *record.AffiliateClickID != common.ID(itAffReserveClick) {
		t.Fatalf("expected reservation to attach click %s, got %+v", itAffReserveClick, record.AffiliateClickID)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var status string
		var source string
		if err := tx.QueryRow(context.Background(), `
			select status, metadata->>'source'
			from affiliate_attribution_reservations
			where reservation_id = $1
		`, itAffReserveReservation).Scan(&status, &source); err != nil {
			t.Fatalf("read reservation: %v", err)
		}
		if status != "pending" || source != "checkout" {
			t.Fatalf("expected pending checkout reservation, got status=%q source=%q", status, source)
		}
	})

	_, err = NewAffiliateRepository(pool).ReserveAffiliateAttribution(
		context.Background(),
		common.TenantScope{BusinessID: itAffReserveBusiness},
		ports.ReserveAffiliateAttributionInput{
			ReservationID: "aaaaaaaa-9999-9999-9999-999999999988",
			BusinessID:    itAffReserveBusiness,
			OrderID:       itAffReserveOrder,
			Code:          itAffReserveCode,
			VisitorID:     "unknown-visitor",
			GrossMinor:    50000,
		},
	)
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected no click match to skip attribution, got %v", err)
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

func seedAffiliateReservationFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupAffiliateReservationFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Affiliate Reserve', 'it-aff-reserve', 'verified')
		`, itAffReserveBusiness, planID)
		mustExec(t, tx, `insert into customers (customer_id, display_name) values ($1, 'IT Affiliate Customer')`,
			itAffReserveCustomer)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'IT Affiliate Design', 'it-affiliate-design', 'active')
		`, itAffReserveDesign, itAffReserveBusiness)
		mustExec(t, tx, `
			insert into orders (order_id, business_id, customer_id, design_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status)
			values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 50000, 0, 'draft')
		`, itAffReserveOrder, itAffReserveBusiness, itAffReserveCustomer, itAffReserveDesign)
		mustExec(t, tx, `
			insert into affiliates (
				affiliate_id,
				code,
				display_name,
				commission_model,
				commission_rate,
				cookie_window_days,
				status
			)
			values ($1, $2, 'IT Reserve Affiliate', 'percentage', 1500, 30, 'active')
		`, itAffReserveAffiliate, itAffReserveCode)
		mustExec(t, tx, `
			insert into affiliate_clicks (
				affiliate_click_id,
				affiliate_id,
				visitor_id,
				landing_url,
				ip_hash
			)
			values ($1, $2, 'reserve-visitor', 'https://demo.xtiitch.test', 'hash')
		`, itAffReserveClick, itAffReserveAffiliate)
	})
}

func cleanupAffiliateReservationFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from affiliate_attribution_reservations where reservation_id = $1`,
			itAffReserveReservation)
		mustExec(t, tx, `delete from affiliates where affiliate_id = $1`, itAffReserveAffiliate)
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAffReserveBusiness)
		mustExec(t, tx, `delete from customers where customer_id = $1`, itAffReserveCustomer)
	})
}

func cleanupAffiliateClickFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from affiliates where affiliate_id = any($1)`,
			[]string{itAffClickActive, itAffClickPaused})
	})
}
