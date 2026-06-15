package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
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
	if _, err := tx.Exec(ctx, `
		delete from customers where customer_id = $1
	`, customerID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
