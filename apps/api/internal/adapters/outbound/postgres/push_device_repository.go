package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// PushDeviceRepository stores the mobile devices a business may notify.

// RegisterPushDevice records a device against this operator, or moves an
// already-known token to them.
//
// The interesting case is a device that is already registered somewhere else.
// Expo issues one token per app installation, so a phone that changes hands —
// or an operator who signs out and a colleague who signs in — presents a token
// another business already claims. The stale claim has to go, because the
// alternative is the previous business continuing to push order alerts, which
// name the customer and the amount, to a phone that is no longer theirs.
//
// That reclaim is the one cross-tenant write here, and it is deliberately as
// narrow as it can be: delete by exact token, nothing else, before the scope
// narrows back to the caller's own business for the insert. Possessing the
// token means possessing the device, which is what makes it safe to honour.
func (repo NotificationRepository) RegisterPushDevice(
	ctx context.Context,
	scope common.TenantScope,
	input ports.RegisterPushDeviceInput,
) (ports.PushDeviceRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.PushDeviceRecord{}, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	// Reclaim first, under the bypass, so a token held by another business does
	// not collide with the insert below. Scoped to this exact token.
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.PushDeviceRecord{}, err
	}
	if _, err := tx.Exec(ctx, `
		delete from push_device_tokens
		where token = $1 and business_id <> $2
	`, input.Token, scope.BusinessID.String()); err != nil {
		return ports.PushDeviceRecord{}, err
	}
	if err := clearTenantBypass(ctx, tx); err != nil {
		return ports.PushDeviceRecord{}, err
	}

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return ports.PushDeviceRecord{}, err
	}

	// Within the business the upsert is ordinary: the app re-registers on every
	// launch, and moving a device between two operators of the SAME business is
	// visible under tenant scope, so no bypass is needed here.
	var record ports.PushDeviceRecord
	var tokenID string
	if err := tx.QueryRow(ctx, `
		insert into push_device_tokens (
			business_id, business_user_id, token, platform, device_name,
			last_seen_at, created_at, updated_at
		)
		values ($1, $2, $3, $4, $5, $6, $6, $6)
		on conflict (token) do update
			set business_user_id = excluded.business_user_id,
				platform = excluded.platform,
				device_name = excluded.device_name,
				last_seen_at = excluded.last_seen_at,
				updated_at = excluded.updated_at
		returning token_id::text, token, platform, device_name, last_seen_at, created_at
	`,
		scope.BusinessID.String(),
		input.UserID.String(),
		input.Token,
		input.Platform,
		input.DeviceName,
		input.Now,
	).Scan(
		&tokenID,
		&record.Token,
		&record.Platform,
		&record.DeviceName,
		&record.LastSeenAt,
		&record.CreatedAt,
	); err != nil {
		return ports.PushDeviceRecord{}, err
	}
	record.TokenID = common.ID(tokenID)

	if err := tx.Commit(ctx); err != nil {
		return ports.PushDeviceRecord{}, err
	}
	return record, nil
}

// UnregisterPushDevice stops a device receiving anything further — the app
// calls it on sign-out. Deleting nothing is success: signing out twice, or
// signing out on a device that never registered, is not an error.
func (repo NotificationRepository) UnregisterPushDevice(
	ctx context.Context,
	scope common.TenantScope,
	token string,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		delete from push_device_tokens
		where business_id = $1 and token = $2
	`, scope.BusinessID.String(), token); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListPushDevices returns this operator's own devices, most recently used
// first — scoped to the operator, not the business, because a settings screen
// showing colleagues' phones would be a privacy leak with no purpose.
func (repo NotificationRepository) ListPushDevices(
	ctx context.Context,
	scope common.TenantScope,
	userID common.ID,
) ([]ports.PushDeviceRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)

	if err := setTenantScope(ctx, tx, scope); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
		select token_id::text, token, platform, device_name, last_seen_at, created_at
		from push_device_tokens
		where business_id = $1 and business_user_id = $2
		order by last_seen_at desc
	`, scope.BusinessID.String(), userID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	devices := make([]ports.PushDeviceRecord, 0)
	for rows.Next() {
		var (
			record  ports.PushDeviceRecord
			tokenID string
		)
		if err := rows.Scan(
			&tokenID,
			&record.Token,
			&record.Platform,
			&record.DeviceName,
			&record.LastSeenAt,
			&record.CreatedAt,
		); err != nil {
			return nil, err
		}
		record.TokenID = common.ID(tokenID)
		devices = append(devices, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return devices, nil
}

// Pruning a token the provider reports as dead is deliberately NOT here. The
// worker learns that while draining the outbox and owns its own connection, so
// it deletes the row there rather than calling back into the API.
