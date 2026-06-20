package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// WhatsAppRepository stores inbound-bot conversation sessions and the dedupe
// ledger. Both are platform-global (the inbound webhook is not tenant-scoped),
// so all access runs under the RLS bypass.
type WhatsAppRepository struct {
	pool *pgxpool.Pool
}

func NewWhatsAppRepository(pool *pgxpool.Pool) WhatsAppRepository {
	return WhatsAppRepository{pool: pool}
}

func (repo WhatsAppRepository) GetSession(ctx context.Context, waID string) (ports.WhatsAppSession, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.WhatsAppSession{}, false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.WhatsAppSession{}, false, err
	}

	var (
		session    ports.WhatsAppSession
		businessID *string
	)
	err = tx.QueryRow(ctx, `
		select wa_id, business_id::text, state, expires_at
		from whatsapp_sessions
		where wa_id = $1 and expires_at > now()
	`, waID).Scan(&session.WaID, &businessID, &session.State, &session.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.WhatsAppSession{}, false, tx.Commit(ctx)
	}
	if err != nil {
		return ports.WhatsAppSession{}, false, err
	}
	if businessID != nil {
		session.BusinessID = *businessID
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.WhatsAppSession{}, false, err
	}
	return session, true, nil
}

func (repo WhatsAppRepository) SaveSession(ctx context.Context, session ports.WhatsAppSession) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	var businessID *string
	if session.BusinessID != "" {
		businessID = &session.BusinessID
	}
	state := session.State
	if len(state) == 0 {
		state = []byte("{}")
	}
	if _, err := tx.Exec(ctx, `
		insert into whatsapp_sessions (wa_id, business_id, state, expires_at, updated_at)
		values ($1, $2, $3, $4, now())
		on conflict (wa_id) do update
		set business_id = excluded.business_id,
			state = excluded.state,
			expires_at = excluded.expires_at,
			updated_at = now()
	`, session.WaID, businessID, state, session.ExpiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo WhatsAppRepository) DeleteSession(ctx context.Context, waID string) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from whatsapp_sessions where wa_id = $1`, waID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// MarkProcessed records the message id and reports whether it was already seen.
// The insert-on-conflict makes the check-and-record atomic, so concurrent
// webhook retries can't both pass.
func (repo WhatsAppRepository) MarkProcessed(ctx context.Context, messageID string) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return false, err
	}

	tag, err := tx.Exec(ctx, `
		insert into whatsapp_inbound_messages (message_id) values ($1)
		on conflict (message_id) do nothing
	`, messageID)
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	// No row inserted => the id was already present => already seen.
	return tag.RowsAffected() == 0, nil
}

// PurgeExpiredSessions removes sessions past their TTL. Cheap maintenance the
// caller can run periodically; not required for correctness (reads filter on
// expires_at), only to keep the table small.
func (repo WhatsAppRepository) PurgeExpiredSessions(ctx context.Context, olderThan time.Time) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from whatsapp_sessions where expires_at < $1`, olderThan); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
