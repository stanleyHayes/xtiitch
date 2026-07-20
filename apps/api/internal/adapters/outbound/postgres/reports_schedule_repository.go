package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §14.1 scheduled reports (000108). Owner-facing reads/writes run tenant
// scoped; the sweep reads/writes cross-tenant under the RLS bypass — the same
// shape the outbox transport uses (§6: only the platform runner, never a
// tenant request, may see across stores).

func (repo ReportsRepository) GetSchedule(ctx context.Context, scope common.TenantScope) (ports.ReportSchedule, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.ReportSchedule{}, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.ReportSchedule{}, err
	}

	var schedule ports.ReportSchedule
	err = tx.QueryRow(ctx, `
		select business_id, report_kind, format, cadence, email, enabled,
			last_sent_at, created_at, updated_at
		from business_report_schedules
		where business_id = $1
	`, scope.BusinessID.String()).Scan(
		&schedule.BusinessID, &schedule.ReportKind, &schedule.Format, &schedule.Cadence,
		&schedule.Email, &schedule.Enabled, &schedule.LastSentAt,
		&schedule.CreatedAt, &schedule.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.ReportSchedule{}, ports.ErrNotFound
	}
	if err != nil {
		return ports.ReportSchedule{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.ReportSchedule{}, err
	}
	return schedule, nil
}

func (repo ReportsRepository) UpsertSchedule(ctx context.Context, scope common.TenantScope, schedule ports.ReportSchedule) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	// One config per business (business_id PK): PUT replaces the whole document.
	// last_sent_at is deliberately NOT reset on edit — changing the format must
	// not re-fire a schedule that already ran this period.
	if _, err := tx.Exec(ctx, `
		insert into business_report_schedules (
			business_id, report_kind, format, cadence, email, enabled
		)
		values ($1, $2, $3, $4, $5, $6)
		on conflict (business_id) do update
		set report_kind = excluded.report_kind,
			format = excluded.format,
			cadence = excluded.cadence,
			email = excluded.email,
			enabled = excluded.enabled,
			updated_at = now()
	`, scope.BusinessID.String(), schedule.ReportKind, schedule.Format,
		schedule.Cadence, schedule.Email, schedule.Enabled); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo ReportsRepository) DueSchedules(ctx context.Context, now time.Time) ([]ports.ReportSchedule, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	// Cross-tenant sweep: platform runner only, like the outbox transport.
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select business_id, report_kind, format, cadence, email, enabled,
			last_sent_at, created_at, updated_at
		from business_report_schedules
		where enabled
			and (
				last_sent_at is null
				or last_sent_at + case cadence
					when 'daily' then interval '1 day'
					when 'weekly' then interval '7 days'
					else interval '1 month'
				end <= $1
			)
		order by business_id
	`, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []ports.ReportSchedule
	for rows.Next() {
		var schedule ports.ReportSchedule
		if err := rows.Scan(
			&schedule.BusinessID, &schedule.ReportKind, &schedule.Format, &schedule.Cadence,
			&schedule.Email, &schedule.Enabled, &schedule.LastSentAt,
			&schedule.CreatedAt, &schedule.UpdatedAt,
		); err != nil {
			return nil, err
		}
		schedules = append(schedules, schedule)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return schedules, nil
}

func (repo ReportsRepository) MarkScheduleSent(ctx context.Context, businessID common.ID, sentAt time.Time) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackAnalyticsUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update business_report_schedules
		set last_sent_at = $2, updated_at = now()
		where business_id = $1
	`, businessID.String(), sentAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
