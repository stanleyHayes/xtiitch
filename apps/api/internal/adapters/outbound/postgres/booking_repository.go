package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BookingRepository struct {
	pool *pgxpool.Pool
}

func NewBookingRepository(pool *pgxpool.Pool) BookingRepository {
	return BookingRepository{pool: pool}
}

func (repo BookingRepository) HoldSlot(ctx context.Context, scope common.TenantScope, input ports.HoldSlotInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Reclaim a stale hold for this slot first: an abandoned (never-paid) hold
	// past its TTL is cancelled, along with its draft order, so it no longer
	// occupies the slot. Cancel the order(s) while the booking is still held, then
	// the booking — all in this transaction, so the reclaim and the new hold below
	// are atomic and the unique-index race guarantee still holds.
	if _, err := tx.Exec(ctx, `
		update orders o set status = 'cancelled', updated_at = now()
		from bookings b
		where b.order_id = o.order_id and b.business_id = o.business_id
			and b.business_id = $1 and b.slot_start = $2 and b.status = 'held'
			and b.created_at < now() - make_interval(mins => $3) and o.status = 'draft'
	`, scope.BusinessID.String(), input.SlotStart, booking.HoldTTLMinutes); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		update bookings set status = 'cancelled', updated_at = now()
		where business_id = $1 and slot_start = $2 and status = 'held'
			and created_at < now() - make_interval(mins => $3)
	`, scope.BusinessID.String(), input.SlotStart, booking.HoldTTLMinutes); err != nil {
		return err
	}

	// The held row IS the reservation; the partial unique index on
	// (business_id, slot_start) over held/booked rows makes a second hold for the
	// same slot impossible, so two customers can never double-book regardless of
	// timing.
	if _, err := tx.Exec(ctx, `
		insert into bookings (booking_id, business_id, customer_id, order_id, slot_start, slot_end, status, address)
		values ($1, $2, $3, $4, $5, $6, 'held', $7)
	`, input.BookingID.String(), input.BusinessID.String(), input.CustomerID.String(), input.OrderID.String(),
		input.SlotStart, input.SlotEnd, input.Address); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "bookings_active_slot_idx" {
			return ports.ErrSlotTaken
		}
		return err
	}

	return tx.Commit(ctx)
}

func (repo BookingRepository) DiscardHeldBooking(ctx context.Context, scope common.TenantScope, bookingID, orderID, customerID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Remove the held booking first (it references the order), then the still-draft
	// order, then the customer. All tenant-scoped; a confirmed booking/order is
	// never touched.
	if _, err := tx.Exec(ctx, `
		delete from bookings where booking_id = $1 and business_id = $2 and status = 'held'
	`, bookingID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		delete from orders where order_id = $1 and business_id = $2 and status = 'draft'
	`, orderID.String(), scope.BusinessID.String()); err != nil {
		return err
	}
	// A customer resolved from an earlier order is shared, so only remove a
	// freshly-created one (the caller passes a zero id otherwise).
	if customerID != "" {
		if _, err := tx.Exec(ctx, `
			delete from customers where customer_id = $1
		`, customerID.String()); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (repo BookingRepository) ListBookings(ctx context.Context, scope common.TenantScope) ([]ports.BookingSummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	// Active visits (held/booked) first, then by soonest slot.
	rows, err := tx.Query(ctx, `
		select b.booking_id, b.order_id, coalesce(c.display_name, ''), coalesce(c.phone, ''),
			coalesce(d.title, ''), b.slot_start, b.slot_end, b.status, b.address
		from bookings b
		left join customers c on c.customer_id = b.customer_id
		left join orders o on o.order_id = b.order_id
		left join designs d on d.design_id = o.design_id
		where b.business_id = $1
		order by (b.status in ('held', 'booked')) desc, b.slot_start
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []ports.BookingSummary
	for rows.Next() {
		var summary ports.BookingSummary
		if err := rows.Scan(&summary.BookingID, &summary.OrderID, &summary.CustomerName, &summary.CustomerPhone,
			&summary.DesignTitle, &summary.SlotStart, &summary.SlotEnd, &summary.Status, &summary.Address); err != nil {
			return nil, err
		}
		summaries = append(summaries, summary)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return summaries, nil
}

func (repo BookingRepository) CancelBooking(ctx context.Context, scope common.TenantScope, bookingID common.ID) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Cancelling drops the row out of the active-slot index, freeing the slot.
	tag, err := tx.Exec(ctx, `
		update bookings set status = 'cancelled', updated_at = now()
		where booking_id = $1 and business_id = $2 and status in ('held', 'booked')
	`, bookingID.String(), scope.BusinessID.String())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return tx.Commit(ctx)
}

func (repo BookingRepository) RescheduleBooking(ctx context.Context, scope common.TenantScope, input ports.RescheduleBookingInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Only a booked (deposit-paid) visit can be rescheduled; carry its order,
	// customer, deposit, and address onto the new slot.
	var customerID, orderID, address string
	var depositPaymentID sql.NullString
	if err := tx.QueryRow(ctx, `
		select customer_id::text, order_id::text, address, deposit_payment_id::text
		from bookings where booking_id = $1 and business_id = $2 and status = 'booked'
	`, input.OldBookingID.String(), scope.BusinessID.String()).Scan(&customerID, &orderID, &address, &depositPaymentID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	// Free the old slot first so a same-slot move does not collide with itself.
	if _, err := tx.Exec(ctx, `
		update bookings set status = 'rescheduled', updated_at = now()
		where booking_id = $1 and business_id = $2 and status = 'booked'
	`, input.OldBookingID.String(), scope.BusinessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into bookings (booking_id, business_id, customer_id, order_id, slot_start, slot_end, status, address, deposit_payment_id)
		values ($1, $2, $3, $4, $5, $6, 'booked', $7, $8)
	`, input.NewBookingID.String(), scope.BusinessID.String(), customerID, orderID,
		input.SlotStart, input.SlotEnd, address, depositPaymentID); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "bookings_active_slot_idx" {
			return ports.ErrSlotTaken
		}
		return err
	}

	return tx.Commit(ctx)
}
