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
		var dayOfMonth any
		if window.DayOfMonth > 0 {
			dayOfMonth = window.DayOfMonth
		}
		var specificDate any
		if !window.SpecificDate.IsZero() {
			specificDate = window.SpecificDate.Format("2006-01-02")
		}
		if _, err := tx.Exec(ctx, `
			insert into availability_windows (window_id, business_id, weekday, start_minute, end_minute, slot_minutes, recurrence, day_of_month, specific_date)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, window.WindowID.String(), scope.BusinessID.String(), window.Weekday, window.StartMinute, window.EndMinute, window.SlotMinutes, window.Recurrence, dayOfMonth, specificDate); err != nil {
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
		select weekday, start_minute, end_minute, slot_minutes, recurrence, day_of_month, specific_date
		from availability_windows where business_id = $1
		order by specific_date nulls first, weekday, start_minute
	`, scope.BusinessID.String())
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	var windows []booking.Window
	for rows.Next() {
		var window booking.Window
		var dayOfMonth *int
		var specificDate *time.Time
		if err := rows.Scan(&window.Weekday, &window.StartMinute, &window.EndMinute, &window.SlotMinutes, &window.Recurrence, &dayOfMonth, &specificDate); err != nil {
			return nil, "", err
		}
		if dayOfMonth != nil {
			window.DayOfMonth = *dayOfMonth
		}
		if specificDate != nil {
			window.SpecificDate = *specificDate
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

func (repo AvailabilityRepository) ListBlackouts(ctx context.Context, scope common.TenantScope, from, to time.Time) ([]time.Time, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select blackout_date from availability_blackouts
		where business_id = $1 and blackout_date >= $2 and blackout_date < $3
	`, scope.BusinessID.String(), from.UTC().Format("2006-01-02"), to.UTC().Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dates []time.Time
	for rows.Next() {
		var date time.Time
		if err := rows.Scan(&date); err != nil {
			return nil, err
		}
		dates = append(dates, date)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return dates, nil
}

func (repo AvailabilityRepository) AddBlackout(ctx context.Context, scope common.TenantScope, date time.Time) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// Idempotent per date: a second mark of the same day is a no-op.
	if _, err := tx.Exec(ctx, `
		insert into availability_blackouts (business_id, blackout_date)
		values ($1, $2)
		on conflict (business_id, blackout_date) do nothing
	`, scope.BusinessID.String(), date.UTC().Format("2006-01-02")); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (repo AvailabilityRepository) RemoveBlackout(ctx context.Context, scope common.TenantScope, date time.Time) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		delete from availability_blackouts where business_id = $1 and blackout_date = $2
	`, scope.BusinessID.String(), date.UTC().Format("2006-01-02")); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
