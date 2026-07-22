package postgres

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ListAdminPayouts assembles the §11.5 payouts CRM: one row per store with its
// payout destination (MoMo network/number/wallet name, subaccount) and the
// figures Paystack is the source of truth for (§3.2) — total sales, total
// settled from the mirrored settlement rows, Xtiitch fees + tax from the
// persisted per-charge figures, and the amount due. The amount due uses the
// SAME formula as the store owner's own net income (§3.1): store share
// (amount − commission − provider fee per persisted record) + manual takings −
// accrued offline commission − successful settlements, so the admin answer to
// "was I paid?" can never diverge from what the owner's Money Desk shows. Runs
// cross-tenant under the RLS bypass, like the other admin reads.
//
//nolint:funlen // one admin query, scan loop, and count query must keep filters and pagination aligned
func (repo AdminAuthRepository) ListAdminPayouts(
	ctx context.Context,
	input ports.ListAdminPayoutsInput,
) ([]ports.AdminPayoutRecord, error) {
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
			b.business_id,
			b.name,
			coalesce(b.handle, ''),
			coalesce(d.full_legal_name, ''),
			coalesce(b.settlement_bank, ''),
			coalesce(b.settlement_mobile_money_number, ''),
			coalesce(b.settlement_momo_account_name, ''),
			coalesce(b.settlement_provider_subaccount, ''),
			coalesce(p.total_sales, 0),
			coalesce(p.fees, 0) - coalesce(p.tax, 0),
			coalesce(p.tax, 0),
			coalesce(p.share, 0) + coalesce(mt.takings, 0) - coalesce(mt.offline_due, 0) - coalesce(st.settled, 0),
			coalesce(st.settled, 0),
			last.settled_at,
			coalesce(last.status, '')
		from businesses b
		left join business_identity_documents d on d.business_id = b.business_id
		left join lateral (
			select sum(p2.amount_minor) as total_sales,
				sum(p2.commission_minor) as fees,
				sum(coalesce(p2.xtiitch_tax_minor, 0)) as tax,
				sum(p2.amount_minor - p2.commission_minor - coalesce(p2.provider_fee_minor, 0)) as share
			from payments p2
			where p2.business_id = b.business_id and p2.status = 'succeeded' and p2.through_platform = true
		) p on true
		left join lateral (
			select sum(m.amount_minor) as takings,
				sum(m.commission_minor) filter (where m.commission_status in ('due', 'invoiced')) as offline_due
			from manual_takings m
			where m.business_id = b.business_id
		) mt on true
		left join lateral (
			select sum(s.amount_minor) as settled
			from paystack_settlements s
			where s.business_id = b.business_id and s.status = 'success'
		) st on true
		left join lateral (
			select s2.settled_at, s2.status
			from paystack_settlements s2
			where s2.business_id = b.business_id
			order by s2.created_at desc
			limit 1
		) last on true
		where $1 = ''
			or b.name ilike '%' || $1 || '%'
			or coalesce(b.handle, '') ilike '%' || $1 || '%'
			or coalesce(d.full_legal_name, '') ilike '%' || $1 || '%'
		order by b.name asc, b.business_id asc
		limit $2 offset $3
	`, escapeILikePattern(strings.TrimSpace(input.Query)), input.Limit, input.Offset)
	if err != nil {
		return nil, err
	}

	var records []ports.AdminPayoutRecord
	for rows.Next() {
		var record ports.AdminPayoutRecord
		if err := rows.Scan(
			&record.BusinessID,
			&record.BusinessName,
			&record.Handle,
			&record.OwnerLegalName,
			&record.MomoNetwork,
			&record.MomoNumber,
			&record.MomoAccountName,
			&record.SubaccountRef,
			&record.TotalSalesMinor,
			&record.XtiitchFeesMinor,
			&record.XtiitchTaxMinor,
			&record.AmountDueMinor,
			&record.TotalSettledMinor,
			&record.LastPayoutAt,
			&record.LastPayoutStatus,
		); err != nil {
			rows.Close()
			return nil, err
		}
		records = append(records, record)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

// ListAdminPayoutHistory pages one store's mirrored settlement rows, most
// recent first — the §11.5 "Payout history" column's backing data.
func (repo AdminAuthRepository) ListAdminPayoutHistory(
	ctx context.Context,
	businessID common.ID,
	limit int,
	offset int,
) ([]ports.AdminPayoutHistoryRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select settlement_id, provider_reference, amount_minor, status, settled_at, created_at
		from paystack_settlements
		where business_id = $1
		order by created_at desc
		limit $2 offset $3
	`, businessID.String(), limit, offset)
	if err != nil {
		return nil, err
	}

	var records []ports.AdminPayoutHistoryRecord
	for rows.Next() {
		var record ports.AdminPayoutHistoryRecord
		if err := rows.Scan(
			&record.SettlementID,
			&record.ProviderReference,
			&record.AmountMinor,
			&record.Status,
			&record.SettledAt,
			&record.CreatedAt,
		); err != nil {
			rows.Close()
			return nil, err
		}
		records = append(records, record)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return records, nil
}

// ListSubaccountedBusinessIDs lists every business with a provider subaccount
// on file — the sync set for the operator/worker settlement sync (§3.3).
func (repo AdminAuthRepository) ListSubaccountedBusinessIDs(ctx context.Context) ([]common.ID, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select business_id::text
		from businesses
		where settlement_provider_subaccount is not null and settlement_provider_subaccount <> ''
		order by created_at asc
	`)
	if err != nil {
		return nil, err
	}

	var ids []common.ID
	for rows.Next() {
		var id common.ID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return ids, nil
}

// escapeILikePattern escapes the LIKE metacharacters in a free-text CRM query
// so a search for "50%" or an underscore matches literally instead of acting
// as a wildcard.
func escapeILikePattern(query string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(query)
}
