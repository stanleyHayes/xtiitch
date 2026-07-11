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

	itSponsoredBusiness       = "aaaaaaaa-7777-7777-7777-777777777781"
	itSponsoredDesign         = "aaaaaaaa-7777-7777-7777-777777777782"
	itSponsoredCampaignActive = "aaaaaaaa-7777-7777-7777-777777777783"
	itSponsoredCampaignPaused = "aaaaaaaa-7777-7777-7777-777777777784"
	itSponsoredCampaignOld    = "aaaaaaaa-7777-7777-7777-777777777785"
	itSponsoredEvent          = "aaaaaaaa-7777-7777-7777-777777777786"
	itSponsoredEventDupe      = "aaaaaaaa-7777-7777-7777-777777777787"

	itAffRefBusiness  = "aaaaaaaa-6666-6666-6666-666666666681"
	itAffRefReferrer  = "aaaaaaaa-6666-6666-6666-666666666682"
	itAffRefReferee   = "aaaaaaaa-6666-6666-6666-666666666683"
	itAffRefDesign    = "aaaaaaaa-6666-6666-6666-666666666684"
	itAffRefOrder     = "aaaaaaaa-6666-6666-6666-666666666685"
	itAffRefProgramme = "aaaaaaaa-6666-6666-6666-666666666686"
	itAffRefCode      = "aaaaaaaa-6666-6666-6666-666666666687"
	itAffRefRecord    = "aaaaaaaa-6666-6666-6666-666666666688"
	itAffRefRecordTwo = "aaaaaaaa-6666-6666-6666-666666666689"
	itAffRefCodeValue = "ITAREFAMA"
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

func TestSponsoredPlacementsListActiveCampaignsAndDedupeEvents(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedSponsoredPlacementFixture(t, pool)
	defer cleanupSponsoredPlacementFixture(t, pool)

	repo := NewAffiliateRepository(pool)
	placements, err := repo.ListActiveSponsoredPlacements(context.Background(), ports.ListActiveSponsoredPlacementsInput{
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("list sponsored placements: %v", err)
	}

	var found ports.SponsoredPlacementRecord
	for _, placement := range placements {
		if placement.CampaignID == common.ID(itSponsoredCampaignActive) {
			found = placement
			break
		}
		if placement.CampaignID == common.ID(itSponsoredCampaignPaused) ||
			placement.CampaignID == common.ID(itSponsoredCampaignOld) {
			t.Fatalf("inactive campaign leaked into public placements: %+v", placement)
		}
	}
	if found.CampaignID.IsZero() ||
		found.BusinessHandle != "it-sponsored-atelier" ||
		found.DesignHandle != "it-sponsored-design" ||
		found.ImageURL != "https://images.test/sponsored.webp" {
		t.Fatalf("expected active promoted design placement, got %+v", found)
	}

	first, err := repo.RecordSponsoredAdEvent(context.Background(), ports.RecordSponsoredAdEventInput{
		EventID:     itSponsoredEvent,
		CampaignID:  itSponsoredCampaignActive,
		EventType:   "impression",
		VisitorID:   "visitor-sponsored",
		PageURL:     "https://xtiitch.test",
		ReferrerURL: "https://search.test",
		UserAgent:   "Integration browser",
		IPHash:      "hashed-ip",
	})
	if err != nil {
		t.Fatalf("record sponsored event: %v", err)
	}
	if first.EventID != common.ID(itSponsoredEvent) || first.Deduped {
		t.Fatalf("expected inserted event, got %+v", first)
	}

	second, err := repo.RecordSponsoredAdEvent(context.Background(), ports.RecordSponsoredAdEventInput{
		EventID:     itSponsoredEventDupe,
		CampaignID:  itSponsoredCampaignActive,
		EventType:   "impression",
		VisitorID:   "visitor-sponsored",
		PageURL:     "https://xtiitch.test",
		ReferrerURL: "https://search.test",
		UserAgent:   "Integration browser",
		IPHash:      "hashed-ip",
	})
	if err != nil {
		t.Fatalf("record duplicate sponsored event: %v", err)
	}
	if second.EventID != common.ID(itSponsoredEvent) || !second.Deduped {
		t.Fatalf("expected duplicate to return existing event, got %+v", second)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var count int
		if err := tx.QueryRow(context.Background(), `
			select count(*)
			from ad_events
			where campaign_id = $1
				and event_type = 'impression'
				and visitor_id = 'visitor-sponsored'
		`, itSponsoredCampaignActive).Scan(&count); err != nil {
			t.Fatalf("count sponsored events: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected one deduped impression event, got %d", count)
		}
	})
}

func TestReferralCodeResolutionAndReservation(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedReferralAttributionFixture(t, pool)
	defer cleanupReferralAttributionFixture(t, pool)

	repo := NewAffiliateRepository(pool)
	code, err := repo.ResolveReferralCode(context.Background(), ports.ResolveReferralCodeInput{
		Code: "itarefama",
	})
	if err != nil {
		t.Fatalf("resolve referral code: %v", err)
	}
	if code.ReferralCodeID != common.ID(itAffRefCode) ||
		code.ReferralProgrammeID != common.ID(itAffRefProgramme) ||
		code.Code != itAffRefCodeValue ||
		code.OwnerCustomerID == nil ||
		*code.OwnerCustomerID != common.ID(itAffRefReferrer) ||
		code.QualifyingOrderMinor != 10000 ||
		code.RewardValue != 5000 {
		t.Fatalf("unexpected referral code record: %+v", code)
	}

	reservation, err := repo.ReserveReferralAttribution(
		context.Background(),
		common.TenantScope{BusinessID: itAffRefBusiness},
		ports.ReserveReferralAttributionInput{
			ReferralID:        itAffRefRecord,
			BusinessID:        itAffRefBusiness,
			OrderID:           itAffRefOrder,
			RefereeCustomerID: itAffRefReferee,
			RefereeEmail:      "referee@example.com",
			RefereePhone:      "0241110000",
			Code:              "itarefama",
			GrossMinor:        50000,
		},
	)
	if err != nil {
		t.Fatalf("reserve referral attribution: %v", err)
	}
	if reservation.ReferralID != common.ID(itAffRefRecord) ||
		reservation.ReferralProgrammeID != common.ID(itAffRefProgramme) ||
		reservation.ReferralCodeID != common.ID(itAffRefCode) ||
		reservation.BusinessID != common.ID(itAffRefBusiness) ||
		reservation.OrderID != common.ID(itAffRefOrder) ||
		reservation.RefereeCustomerID != common.ID(itAffRefReferee) ||
		reservation.GrossMinor != 50000 ||
		reservation.Status != "pending" {
		t.Fatalf("unexpected referral reservation: %+v", reservation)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var status string
		var source string
		var referrer string
		if err := tx.QueryRow(context.Background(), `
			select status, metadata->>'source', coalesce(referrer_customer_id::text, '')
			from referrals
			where referral_id = $1
		`, itAffRefRecord).Scan(&status, &source, &referrer); err != nil {
			t.Fatalf("read referral reservation: %v", err)
		}
		if status != "pending" || source != "checkout" || referrer != itAffRefReferrer {
			t.Fatalf("expected pending checkout referral, got status=%q source=%q referrer=%q", status, source, referrer)
		}
	})

	_, err = repo.ReserveReferralAttribution(
		context.Background(),
		common.TenantScope{BusinessID: itAffRefBusiness},
		ports.ReserveReferralAttributionInput{
			ReferralID:        itAffRefRecordTwo,
			BusinessID:        itAffRefBusiness,
			OrderID:           itAffRefOrder,
			RefereeCustomerID: itAffRefReferrer,
			Code:              itAffRefCodeValue,
			GrossMinor:        50000,
		},
	)
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected self-referral to be unavailable, got %v", err)
	}

	_, err = repo.ReserveReferralAttribution(
		context.Background(),
		common.TenantScope{BusinessID: itAffRefBusiness},
		ports.ReserveReferralAttributionInput{
			ReferralID:        itAffRefRecordTwo,
			BusinessID:        itAffRefBusiness,
			OrderID:           itAffRefOrder,
			RefereeCustomerID: itAffRefReferee,
			RefereeEmail:      "REFERRER@example.com",
			RefereePhone:      "0245550000",
			Code:              itAffRefCodeValue,
			GrossMinor:        50000,
		},
	)
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected contact-matched self-referral to be unavailable, got %v", err)
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

func seedSponsoredPlacementFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupSponsoredPlacementFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status, operational_status)
			values ($1, $2, 'IT Sponsored Atelier', 'it-sponsored-atelier', 'verified', 'active')
		`, itSponsoredBusiness, planID)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, images, handle, status)
			values ($1, $2, 'IT Sponsored Design', array['https://images.test/sponsored.webp'], 'it-sponsored-design', 'active')
		`, itSponsoredDesign, itSponsoredBusiness)
		mustExec(t, tx, `
			insert into ad_campaigns (
				campaign_id,
				advertiser_business_id,
				placement_type,
				target_ref_id,
				headline,
				description,
				status,
				pricing_model,
				budget_minor,
				starts_at,
				ends_at
			)
			values
				($1, $2, 'promoted_design', $3, 'Sponsored design',
				 'Visible on the public marketing site.', 'active', 'flat_time', 25000,
				 now() - interval '1 day', now() + interval '7 days'),
				($4, $2, 'featured_business', '', 'Paused placement',
				 'Should not render.', 'paused', 'flat_time', 25000,
				 now() - interval '1 day', now() + interval '7 days'),
				($5, $2, 'featured_business', '', 'Old placement',
				 'Should not render.', 'active', 'flat_time', 25000,
				 now() - interval '10 days', now() - interval '1 day')
		`, itSponsoredCampaignActive, itSponsoredBusiness, itSponsoredDesign, itSponsoredCampaignPaused, itSponsoredCampaignOld)
	})
}

func cleanupSponsoredPlacementFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itSponsoredBusiness)
	})
}

func seedReferralAttributionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	cleanupReferralAttributionFixture(t, pool)

	var planID string
	if err := pool.QueryRow(context.Background(), itPlanProbe).Scan(&planID); err != nil {
		t.Fatalf("probe plan: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into businesses (business_id, plan_id, name, handle, verification_status)
			values ($1, $2, 'IT Referral Atelier', 'it-referral-atelier', 'verified')
		`, itAffRefBusiness, planID)
		mustExec(t, tx, `
			insert into customers (customer_id, display_name, email, phone)
			values
				($1, 'IT Referral Referrer', 'referrer@example.com', '(024) 555-0000'),
				($2, 'IT Referral Referee', 'referee@example.com', '0241110000')
		`, itAffRefReferrer, itAffRefReferee)
		mustExec(t, tx, `
			insert into designs (design_id, business_id, title, handle, status)
			values ($1, $2, 'IT Referral Design', 'it-referral-design', 'active')
		`, itAffRefDesign, itAffRefBusiness)
		mustExec(t, tx, `
			insert into orders (order_id, business_id, customer_id, design_id,
				order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status)
			values ($1, $2, $3, $4, 'standard', 'band', 'ready_made', 'online', 50000, 0, 'draft')
		`, itAffRefOrder, itAffRefBusiness, itAffRefReferee, itAffRefDesign)
		mustExec(t, tx, `
			insert into referral_programmes (
				referral_programme_id,
				title,
				code_prefix,
				audience,
				referrer_reward_kind,
				referee_reward_kind,
				reward_type,
				reward_value,
				qualifying_order_min_minor,
				status
			)
			values ($1, 'IT Referral Programme', 'ITAREF', 'customers', 'voucher', 'voucher', 'fixed', 5000, 10000, 'active')
		`, itAffRefProgramme)
		mustExec(t, tx, `
			insert into referral_codes (
				referral_code_id,
				referral_programme_id,
				owner_type,
				owner_customer_id,
				code,
				status
			)
			values ($1, $2, 'customer', $3, $4, 'active')
		`, itAffRefCode, itAffRefProgramme, itAffRefReferrer, itAffRefCodeValue)
	})
}

func cleanupReferralAttributionFixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from businesses where business_id = $1`, itAffRefBusiness)
		mustExec(t, tx, `delete from referral_programmes where referral_programme_id = $1`, itAffRefProgramme)
		mustExec(t, tx, `delete from customers where customer_id = any($1)`,
			[]string{itAffRefReferrer, itAffRefReferee})
	})
}
