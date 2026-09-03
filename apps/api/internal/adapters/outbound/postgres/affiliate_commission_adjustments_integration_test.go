package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

const (
	itAdjustmentAffiliate  = "81818181-1111-4111-8111-111111111111"
	itAdjustmentSource     = "81818181-2222-4222-8222-222222222222"
	itAdjustmentPartial    = "81818181-3333-4333-8333-333333333333"
	itAdjustmentRemainder  = "81818181-4444-4444-8444-444444444444"
	itAdjustmentFullSource = "81818181-5555-4555-8555-555555555555"
	itAdjustmentFullEvent  = "81818181-6666-4666-8666-666666666666"
	itAdjustmentFullReplay = "81818181-7777-4777-8777-777777777777"
	itAdjustmentPaymentRef = "it-affiliate-adjustment-payment"
	itAdjustmentFullRef    = "it-affiliate-full-refund-payment"
)

func TestApplyFirstPaidPlanProviderEventAuditsPartialAndPostPayoutRefunds(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedSubscriptionInvoiceFixtures(t, pool)
	defer cleanupSubscriptionInvoiceFixtures(t, pool)
	defer func() {
		inBypass(t, pool, func(tx pgx.Tx) {
			mustExec(t, tx, `delete from affiliate_portal_audit_events where affiliate_id=$1`, itAdjustmentAffiliate)
			mustExec(t, tx, `delete from affiliate_conversions where affiliate_id=$1`, itAdjustmentAffiliate)
			mustExec(t, tx, `delete from affiliates where affiliate_id=$1`, itAdjustmentAffiliate)
		})
	}()

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `insert into affiliates(affiliate_id,code,display_name,commission_model,commission_rate,status)
			values($1,'ITADJUST','IT Adjustment Affiliate','percentage',2000,'active')`, itAdjustmentAffiliate)
		mustExec(t, tx, `insert into affiliate_conversions(
			affiliate_conversion_id,affiliate_id,business_id,conversion_type,subscription_id,
			payment_reference,gross_minor,commission_minor,commission_model,commission_rate,
			status,hold_until)
			values($1,$2,$3,'subscription_payment',$4,$5,5000,1000,'percentage',2000,
			'pending',now()+interval '14 days')`, itAdjustmentSource, itAdjustmentAffiliate,
			itSubBizPaid, itSubPaid, itAdjustmentPaymentRef)
		mustExec(t, tx, `insert into affiliate_conversions(
			affiliate_conversion_id,affiliate_id,business_id,conversion_type,subscription_id,
			payment_reference,gross_minor,commission_minor,commission_model,commission_rate,
			status,hold_until)
			values($1,$2,$3,'subscription_payment',$4,$5,5000,1000,'percentage',2000,
			'pending',now()+interval '14 days')`, itAdjustmentFullSource, itAdjustmentAffiliate,
			itSubBizFailed, itSubFailed, itAdjustmentFullRef)
	})

	repo := NewAffiliateRepository(pool)
	if err := repo.ApplyFirstPaidPlanProviderEvent(context.Background(), ports.ApplyFirstPaidPlanProviderEventInput{
		ConversionID: itAdjustmentFullEvent, PaymentReference: itAdjustmentFullRef,
		EventType: "refund.processed", AmountMinor: 5000,
		EventSignature: "paystack:refund.processed:full", Succeeded: false,
	}); err != nil {
		t.Fatalf("apply full pre-maturity refund: %v", err)
	}
	if err := repo.ApplyFirstPaidPlanProviderEvent(context.Background(), ports.ApplyFirstPaidPlanProviderEventInput{
		ConversionID: itAdjustmentFullReplay, PaymentReference: itAdjustmentFullRef,
		EventType: "refund.processed", AmountMinor: 5000,
		EventSignature: "paystack:refund.processed:full-replay", Succeeded: false,
	}); err != nil {
		t.Fatalf("apply second full-refund event: %v", err)
	}
	inBypass(t, pool, func(tx pgx.Tx) {
		var status string
		var adjustments int
		if err := tx.QueryRow(context.Background(), `select status from affiliate_conversions where affiliate_conversion_id=$1`, itAdjustmentFullSource).Scan(&status); err != nil {
			t.Fatalf("read full-refund source: %v", err)
		}
		if err := tx.QueryRow(context.Background(), `select count(*)::int from affiliate_conversions where source_conversion_id=$1`, itAdjustmentFullSource).Scan(&adjustments); err != nil {
			t.Fatalf("count full-refund adjustments: %v", err)
		}
		if status != "reversed" || adjustments != 0 {
			t.Fatalf("expected direct full refund to reverse pending commission, status=%s adjustments=%d", status, adjustments)
		}
	})

	partial := ports.ApplyFirstPaidPlanProviderEventInput{
		ConversionID: itAdjustmentPartial, PaymentReference: itAdjustmentPaymentRef,
		EventType: "refund.processed", AmountMinor: 2000,
		EventSignature: "paystack:refund.processed:partial", Succeeded: false,
	}
	if err := repo.ApplyFirstPaidPlanProviderEvent(context.Background(), partial); err != nil {
		t.Fatalf("apply partial refund: %v", err)
	}
	if err := repo.ApplyFirstPaidPlanProviderEvent(context.Background(), partial); err != nil {
		t.Fatalf("redeliver partial refund: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var count int
		var gross, commission int64
		var status string
		if err := tx.QueryRow(context.Background(), `select count(*)::int,min(gross_minor),min(commission_minor),min(status)
			from affiliate_conversions where source_conversion_id=$1`, itAdjustmentSource).
			Scan(&count, &gross, &commission, &status); err != nil {
			t.Fatalf("read partial adjustment: %v", err)
		}
		if count != 1 || gross != -2000 || commission != -400 || status != "pending" {
			t.Fatalf("unexpected partial adjustment count=%d gross=%d commission=%d status=%s", count, gross, commission, status)
		}
		mustExec(t, tx, `update affiliate_conversions set status='settled',settled_at=now() where affiliate_conversion_id=$1`, itAdjustmentSource)
	})

	if err := repo.ApplyFirstPaidPlanProviderEvent(context.Background(), ports.ApplyFirstPaidPlanProviderEventInput{
		ConversionID: itAdjustmentRemainder, PaymentReference: itAdjustmentPaymentRef,
		EventType: "refund.processed", AmountMinor: 5000,
		EventSignature: "paystack:refund.processed:remainder", Succeeded: false,
	}); err != nil {
		t.Fatalf("apply post-payout refund remainder: %v", err)
	}

	inBypass(t, pool, func(tx pgx.Tx) {
		var sourceStatus string
		var refundTotal, debitTotal int64
		var approved int
		if err := tx.QueryRow(context.Background(), `select status from affiliate_conversions where affiliate_conversion_id=$1`, itAdjustmentSource).Scan(&sourceStatus); err != nil {
			t.Fatalf("read settled source: %v", err)
		}
		if err := tx.QueryRow(context.Background(), `select coalesce(sum(-gross_minor),0),coalesce(sum(-commission_minor),0),count(*) filter(where status='approved')::int
			from affiliate_conversions where source_conversion_id=$1`, itAdjustmentSource).Scan(&refundTotal, &debitTotal, &approved); err != nil {
			t.Fatalf("read adjustment totals: %v", err)
		}
		if sourceStatus != "settled" || refundTotal != 5000 || debitTotal != 1000 || approved != 1 {
			t.Fatalf("expected settled history plus full negative carry, source=%s refund=%d debit=%d approved=%d", sourceStatus, refundTotal, debitTotal, approved)
		}
	})
}
