package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

func (repo AdminAuthRepository) ListAdminVerificationCases(ctx context.Context) ([]ports.AdminVerificationCaseRecord, error) {
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
			p.name,
			p.code,
			b.verification_status,
			coalesce(b.settlement_provider, ''),
			coalesce(b.settlement_provider_subaccount, ''),
			coalesce(b.settlement_mobile_money_number, ''),
			coalesce(d.card_number, ''),
			coalesce(d.id_photo_url, ''),
			coalesce(d.id_photo_back_url, ''),
			b.created_at,
			b.updated_at
		from businesses b
		join plans p on p.plan_id = b.plan_id
		left join business_identity_documents d on d.business_id = b.business_id
		left join lateral (
			select u.display_name, u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
		order by
			case b.verification_status
				when 'pending' then 1
				when 'unverified' then 2
				when 'rejected' then 3
				else 4
			end,
			b.updated_at desc,
			b.created_at desc
		limit 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminVerificationCaseRecord{}
	for rows.Next() {
		record, err := scanAdminVerificationCaseRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func (repo AdminAuthRepository) DecideAdminBusinessVerification(
	ctx context.Context,
	input ports.AdminBusinessVerificationDecisionInput,
) (ports.AdminVerificationCaseRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	record, err := scanAdminVerificationCaseRecord(tx.QueryRow(ctx, `
		with updated as (
			update businesses
			set verification_status = $2,
				updated_at = now()
			where business_id = $1
			returning *
		)
		select
			b.business_id::text,
			b.name,
			b.handle,
			coalesce(owner.display_name, ''),
			coalesce(owner.email, ''),
			p.name,
			p.code,
			b.verification_status,
			coalesce(b.settlement_provider, ''),
			coalesce(b.settlement_provider_subaccount, ''),
			coalesce(b.settlement_mobile_money_number, ''),
			coalesce(d.card_number, ''),
			coalesce(d.id_photo_url, ''),
			coalesce(d.id_photo_back_url, ''),
			b.created_at,
			b.updated_at
		from updated b
		join plans p on p.plan_id = b.plan_id
		left join business_identity_documents d on d.business_id = b.business_id
		left join lateral (
			select u.display_name, u.email
			from business_users u
			where u.business_id = b.business_id and u.role = 'owner'
			order by u.created_at
			limit 1
		) owner on true
	`, input.BusinessID.String(), string(input.Status)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminVerificationCaseRecord{}, ErrNotFound
		}
		return ports.AdminVerificationCaseRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}

	return record, nil
}

func scanAdminVerificationCaseRecord(row pgx.Row) (ports.AdminVerificationCaseRecord, error) {
	var record ports.AdminVerificationCaseRecord
	var status string
	if err := row.Scan(
		&record.BusinessID,
		&record.BusinessName,
		&record.Handle,
		&record.OwnerName,
		&record.OwnerEmail,
		&record.PlanName,
		&record.PlanCode,
		&status,
		&record.SettlementProvider,
		&record.SettlementSubaccount,
		&record.SettlementAccountHint,
		&record.IDCardNumber,
		&record.IDPhotoURL,
		&record.IDPhotoBackURL,
		&record.SubmittedAt,
		&record.UpdatedAt,
	); err != nil {
		return ports.AdminVerificationCaseRecord{}, err
	}
	record.VerificationStatus = business.VerificationStatus(status)

	return record, nil
}
