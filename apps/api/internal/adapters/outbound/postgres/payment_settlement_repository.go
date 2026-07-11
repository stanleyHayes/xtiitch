package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// applyPaymentSuccess routes a genuine payment success to the right settlement
// by purpose: a booking deposit confirms the visit + its order, a balance credits
// the confirmed order, and everything else confirms a draft order at its first stage.
func applyPaymentSuccess(ctx context.Context, tx pgx.Tx, payment scopedPayment) error {
	switch payment.purpose {
	case "booking_deposit":
		return confirmBookingOnPayment(ctx, tx, payment)
	case "balance":
		// Settle by the order portion (settleAmountMinor), NOT the gross charge: a
		// buyer-borne platform fee is not part of the order's balance.
		return creditOrderBalance(ctx, tx, payment.businessID, payment.orderID.String, payment.paymentID, payment.settleAmountMinor)
	case "cart_full":
		// One combined charge anchored on the first order: confirm every order in
		// its checkout group, each settled by its own line total.
		return confirmOrderGroupOnPayment(ctx, tx, payment.businessID, payment.orderID.String)
	default:
		return confirmOrderOnPayment(ctx, tx, payment.businessID, payment.orderID.String, payment.settleAmountMinor)
	}
}

// confirmOrderGroupOnPayment confirms every still-draft order that shares the
// anchor order's checkout group, each settled by its own agreed_total_minor
// (not the combined charge amount) — exact for the made-to-wear cart, where
// every line was paid in full in one transaction. The tenant scope is already
// set by applyConfirmation, matching the other confirm helpers. If the anchor
// carries no group (defensive), it confirms the anchor alone.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func confirmOrderGroupOnPayment(ctx context.Context, tx pgx.Tx, businessID, anchorOrderID string) error {
	var groupID sql.NullString
	err := tx.QueryRow(ctx, `
		select checkout_group_id from orders where order_id = $1 and business_id = $2
	`, anchorOrderID, businessID).Scan(&groupID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	type member struct {
		orderID     string
		amountMinor int64
	}
	var members []member
	if groupID.Valid {
		rows, err := tx.Query(ctx, `
			select order_id::text, agreed_total_minor
			from orders
			where checkout_group_id = $1 and business_id = $2 and status = 'draft'
		`, groupID.String, businessID)
		if err != nil {
			return err
		}
		for rows.Next() {
			var m member
			if err := rows.Scan(&m.orderID, &m.amountMinor); err != nil {
				rows.Close()
				return err
			}
			members = append(members, m)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
	}
	if len(members) == 0 {
		// No group, or it was already confirmed: fall back to the anchor.
		return confirmOrderOnPayment(ctx, tx, businessID, anchorOrderID, 0)
	}

	for _, m := range members {
		if err := confirmOrderOnPayment(ctx, tx, businessID, m.orderID, m.amountMinor); err != nil {
			return err
		}
	}
	return nil
}

// confirmBookingOnPayment moves a held home-visit slot to booked (recording the
// deposit payment) and confirms its draft order at the first bespoke stage. The
// held-only guard makes a re-delivered event a no-op.
func confirmBookingOnPayment(ctx context.Context, tx pgx.Tx, payment scopedPayment) error {
	if !payment.bookingID.Valid {
		return nil
	}
	tag, err := tx.Exec(ctx, `
		update bookings set status = 'booked', deposit_payment_id = $3, updated_at = now()
		where booking_id = $1 and business_id = $2 and status = 'held'
	`, payment.bookingID.String, payment.businessID, payment.paymentID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	if err := confirmOrderOnPayment(ctx, tx, payment.businessID, payment.orderID.String, payment.amountMinor); err != nil {
		return err
	}
	return enqueueBookingNotification(ctx, tx, payment.businessID, payment.bookingID.String, notification.KindBookingConfirmed)
}

// releaseBooking cancels a held booking and its draft order, freeing the slot.
// The held/draft guards keep it idempotent and prevent touching a confirmed visit.
func releaseBooking(ctx context.Context, tx pgx.Tx, businessID, bookingID, orderID string) error {
	tag, err := tx.Exec(ctx, `
		update bookings set status = 'cancelled', updated_at = now()
		where booking_id = $1 and business_id = $2 and status = 'held'
	`, bookingID, businessID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	_, err = tx.Exec(ctx, `
		update orders set status = 'cancelled', updated_at = now()
		where order_id = $1 and business_id = $2 and status = 'draft'
	`, orderID, businessID)
	return err
}

// creditOrderBalance applies a balance payment to an already-confirmed order:
// it credits the settled amount without touching the production stage. Every
// statement is scoped to the payment's own business, so a stray cross-tenant
// order_id credits nothing. settled_minor is capped at the agreed total, so even
// a duplicated balance charge can never settle more than is owed.
func creditOrderBalance(ctx context.Context, tx pgx.Tx, businessID, orderID, paymentID string, amountMinor int64) error {
	tag, err := tx.Exec(ctx, `
		update orders
		set settled_minor = least(settled_minor + $3, agreed_total_minor), updated_at = now()
		where order_id = $1 and business_id = $2
			and status in ('confirmed', 'fulfilled') and agreed_total_minor is not null
	`, orderID, businessID, amountMinor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	return enqueueBalancePaymentNotification(ctx, tx, businessID, orderID, paymentID, amountMinor)
}

// confirmOrderOnPayment moves the order from draft to confirmed at its first
// stage and credits the settled amount. Every statement is constrained to the
// payment's own business, so a stray cross-tenant order_id finds no row and
// settles nothing — defence in depth alongside the now-restored RLS.
func confirmOrderOnPayment(ctx context.Context, tx pgx.Tx, businessID, orderID string, amountMinor int64) error {
	var stageID string
	err := tx.QueryRow(ctx, `
		select st.stage_id
		from orders o
		join stage_templates st on st.business_id = o.business_id and st.flow = o.flow
		where o.order_id = $1 and o.business_id = $2
		order by st.sequence
		limit 1
	`, orderID, businessID).Scan(&stageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update orders
		set status = 'confirmed', current_stage_id = $2,
			settled_minor = settled_minor + $3, updated_at = now()
		where order_id = $1 and business_id = $4 and status = 'draft'
	`, orderID, stageID, amountMinor, businessID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	if _, err = tx.Exec(ctx, `
		insert into stage_events (event_id, business_id, order_id, stage_id)
		select gen_random_uuid(), o.business_id, o.order_id, $2
		from orders o where o.order_id = $1 and o.business_id = $3
	`, orderID, stageID, businessID); err != nil {
		return err
	}

	if err := applyPendingPromotionRedemptionsForOrder(ctx, tx, businessID, orderID); err != nil {
		return err
	}
	if err := applyPendingAffiliateAttributionForOrder(ctx, tx, businessID, orderID); err != nil {
		return err
	}
	if err := qualifyPendingReferralAttributionForOrder(ctx, tx, businessID, orderID); err != nil {
		return err
	}

	// The order is now confirmed; in the same transaction, record the intent to
	// tell the customer. The dedup key makes a redelivered webhook a no-op.
	if err := enqueueOrderNotification(ctx, tx, businessID, orderID, notification.KindOrderConfirmed); err != nil {
		return err
	}
	// Also alert the store owner that a new order landed (by SMS), so they can
	// action it — especially a bespoke order needing a direct price negotiation.
	// No-op when the owner has no phone on file.
	return enqueueOwnerNewOrderNotification(ctx, tx, businessID, orderID)
}

func applyPendingPromotionRedemptionsForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update promotion_redemptions
		set status = 'applied', redeemed_at = now(), updated_at = now()
		where business_id = $1 and order_id = $2 and status = 'pending'
	`, businessID, orderID)
	return err
}

func voidPendingPromotionRedemptionsForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update promotion_redemptions
		set status = 'void', updated_at = now()
		where business_id = $1 and order_id = $2 and status = 'pending'
	`, businessID, orderID)
	return err
}

func applyPendingAffiliateAttributionForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		with reservation as (
			update affiliate_attribution_reservations
			set status = 'converted', updated_at = now()
			where business_id = $1
				and order_id = $2
				and status = 'pending'
			returning *
		)
		insert into affiliate_conversions (
			affiliate_id,
			affiliate_click_id,
			business_id,
			order_id,
			gross_minor,
			commission_minor,
			commission_model,
			commission_rate,
			attribution_model,
			status,
			hold_until,
			metadata
		)
		select
			affiliate_id,
			affiliate_click_id,
			business_id,
			order_id,
			gross_minor,
			commission_minor,
			commission_model,
			commission_rate,
			attribution_model,
			'pending',
			now() + interval '14 days',
			metadata || jsonb_build_object(
				'reservation_id', reservation_id::text,
				'source', 'payment_success'
			)
		from reservation
		on conflict (order_id) do nothing
	`, businessID, orderID)
	return err
}

func voidPendingAffiliateAttributionForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update affiliate_attribution_reservations
		set status = 'void', updated_at = now()
		where business_id = $1
			and order_id = $2
			and status = 'pending'
	`, businessID, orderID)
	return err
}

func qualifyPendingReferralAttributionForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update referrals
		set status = 'qualified',
			qualified_at = now(),
			updated_at = now(),
			metadata = metadata || jsonb_build_object('source', 'payment_success')
		where business_id = $1
			and order_id = $2
			and status = 'pending'
	`, businessID, orderID)
	return err
}

func voidPendingReferralAttributionForOrder(ctx context.Context, tx pgx.Tx, businessID, orderID string) error {
	_, err := tx.Exec(ctx, `
		update referrals
		set status = 'void',
			updated_at = now(),
			metadata = metadata || jsonb_build_object('source', 'payment_failed')
		where business_id = $1
			and order_id = $2
			and status = 'pending'
	`, businessID, orderID)
	return err
}
