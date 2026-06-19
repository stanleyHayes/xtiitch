package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// DesignWaitlistRepository persists design waiting-list registrations. Every
// operation runs under the resolved business's tenant scope, so row-level
// security keeps one business's list from ever touching another's.
type DesignWaitlistRepository struct {
	pool *pgxpool.Pool
}

func NewDesignWaitlistRepository(pool *pgxpool.Pool) DesignWaitlistRepository {
	return DesignWaitlistRepository{pool: pool}
}

// Join registers a customer's interest in a design. The scope is the business the
// public store handle resolved to; re-joining with the same contact is idempotent.
func (repo DesignWaitlistRepository) Join(ctx context.Context, scope common.TenantScope, input ports.DesignWaitlistEntryInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into design_waitlist_entries (
			entry_id, business_id, design_id, customer_name, customer_contact, note
		)
		values ($1, $2, $3, $4, $5, $6)
		on conflict (design_id, lower(customer_contact)) do update
			set customer_name = excluded.customer_name,
				note = excluded.note,
				status = 'waiting',
				updated_at = now()
	`, input.EntryID.String(), input.BusinessID.String(), input.DesignID.String(),
		input.CustomerName, input.CustomerContact, input.Note); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// List returns the business's waiting-list registrations, newest first.
func (repo DesignWaitlistRepository) List(ctx context.Context, scope common.TenantScope) ([]ports.DesignWaitlistEntry, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select w.entry_id, w.design_id, coalesce(d.title, ''), coalesce(d.handle, ''),
			w.customer_name, w.customer_contact, w.note, w.status, w.created_at
		from design_waitlist_entries w
		join designs d on d.design_id = w.design_id
		where w.business_id = $1
		order by w.created_at desc
	`, scope.BusinessID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []ports.DesignWaitlistEntry{}
	for rows.Next() {
		var entry ports.DesignWaitlistEntry
		if err := rows.Scan(
			&entry.EntryID, &entry.DesignID, &entry.DesignTitle, &entry.DesignHandle,
			&entry.CustomerName, &entry.CustomerContact, &entry.Note, &entry.Status, &entry.CreatedAt,
		); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return entries, nil
}

// UpdateStatus moves an entry between waiting/notified/closed. Row-level security
// scopes the update to the caller's business, so the entry_id alone is safe.
func (repo DesignWaitlistRepository) UpdateStatus(ctx context.Context, scope common.TenantScope, entryID common.ID, status string) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		update design_waitlist_entries
		set status = $2, updated_at = now()
		where entry_id = $1
	`, entryID.String(), status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return tx.Commit(ctx)
}
