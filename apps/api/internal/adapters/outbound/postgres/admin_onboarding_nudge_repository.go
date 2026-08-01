package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const onboardingNudgeKindVerification = "verification_nudge"

// ListBusinessesForVerificationNudge returns unverified tenants older than the
// cutoff that have not yet received the given onboarding reminder kind.
//
//nolint:funlen // long by construction: one large SQL statement plus its row scan. Splitting it would hide the query from its mapping, not simplify it.
func (repo AdminAuthRepository) ListBusinessesForVerificationNudge(
	ctx context.Context,
	olderThan time.Time,
	kind string,
	limit int,
) ([]ports.BusinessOnboardingNudgeCandidate, error) {
	if kind == "" {
		kind = onboardingNudgeKindVerification
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.display_name, ''),
			coalesce(owner.email, ''),
			b.created_at
		from businesses b
		left join lateral (
			select u.display_name, u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		where b.verification_status = 'unverified'
			and b.operational_status = 'active'
			and b.created_at <= $1
			and not exists (
				select 1
				from business_onboarding_reminders r
				where r.business_id = b.business_id and r.kind = $2
			)
			and coalesce(owner.email, '') <> ''
		order by b.created_at asc
		limit $3
	`, olderThan.UTC(), kind, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ports.BusinessOnboardingNudgeCandidate{}
	for rows.Next() {
		var candidate ports.BusinessOnboardingNudgeCandidate
		if err := rows.Scan(
			&candidate.BusinessID,
			&candidate.BusinessName,
			&candidate.Handle,
			&candidate.OwnerName,
			&candidate.OwnerEmail,
			&candidate.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, candidate)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

// ClaimOnboardingReminder inserts the (business, kind) idempotency row. Returns
// claimed=false when that reminder was already sent.
func (repo AdminAuthRepository) ClaimOnboardingReminder(
	ctx context.Context,
	businessID common.ID,
	kind string,
) (bool, error) {
	if businessID.IsZero() || kind == "" {
		return false, errors.New("business id and kind are required")
	}

	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return false, err
	}

	tag, err := tx.Exec(ctx, `
		insert into business_onboarding_reminders (business_id, kind)
		values ($1::uuid, $2)
		on conflict (business_id, kind) do nothing
	`, businessID.String(), kind)
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
