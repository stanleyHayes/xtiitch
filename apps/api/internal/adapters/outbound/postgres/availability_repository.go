package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AvailabilityRepository struct {
	pool *pgxpool.Pool
}

func NewAvailabilityRepository(pool *pgxpool.Pool) AvailabilityRepository {
	return AvailabilityRepository{pool: pool}
}

func (repo AvailabilityRepository) ReplaceWindows(ctx context.Context, scope common.TenantScope, windows []ports.AvailabilityWindow) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `delete from availability_windows where business_id = $1`, scope.BusinessID.String()); err != nil {
		return err
	}
	for _, window := range windows {
		if _, err := tx.Exec(ctx, `
			insert into availability_windows (window_id, business_id, weekday, start_minute, end_minute, slot_minutes)
			values ($1, $2, $3, $4, $5, $6)
		`, window.WindowID.String(), scope.BusinessID.String(), window.Weekday, window.StartMinute, window.EndMinute, window.SlotMinutes); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (repo AvailabilityRepository) ListWindows(ctx context.Context, scope common.TenantScope) ([]booking.Window, string, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, "", err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, "", err
	}

	timezone := "Africa/Accra"
	if err := tx.QueryRow(ctx, `select business_timezone from store_settings where business_id = $1`,
		scope.BusinessID.String()).Scan(&timezone); err != nil {
		return nil, "", err
	}

	rows, err := tx.Query(ctx, `
		select weekday, start_minute, end_minute, slot_minutes
		from availability_windows where business_id = $1
		order by weekday, start_minute
	`, scope.BusinessID.String())
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	var windows []booking.Window
	for rows.Next() {
		var window booking.Window
		if err := rows.Scan(&window.Weekday, &window.StartMinute, &window.EndMinute, &window.SlotMinutes); err != nil {
			return nil, "", err
		}
		windows = append(windows, window)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, "", err
	}
	return windows, timezone, nil
}

func (repo AvailabilityRepository) ListTakenSlots(ctx context.Context, scope common.TenantScope, from, to time.Time) ([]time.Time, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	// A booked slot is always taken; a held slot only counts while its hold is
	// still fresh, so an abandoned (never-paid) hold past its TTL returns to
	// availability instead of blocking the slot forever.
	rows, err := tx.Query(ctx, `
		select slot_start from bookings
		where business_id = $1 and slot_start >= $2 and slot_start < $3
			and (status = 'booked'
				or (status = 'held' and created_at > now() - make_interval(mins => $4)))
	`, scope.BusinessID.String(), from, to, booking.HoldTTLMinutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var taken []time.Time
	for rows.Next() {
		var slot time.Time
		if err := rows.Scan(&slot); err != nil {
			return nil, err
		}
		taken = append(taken, slot)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return taken, nil
}
