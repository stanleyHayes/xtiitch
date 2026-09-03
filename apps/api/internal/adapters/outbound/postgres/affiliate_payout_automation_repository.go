package postgres

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ClaimDueAffiliatePayout(ctx context.Context, batchID common.ID, now time.Time) (ports.AffiliatePayoutDispatch, bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}

	var dispatch ports.AffiliatePayoutDispatch
	err = tx.QueryRow(ctx, `
		with retryable as (
		  select b.payout_batch_id from affiliate_payout_batches b
		  join affiliates a on a.affiliate_id=b.affiliate_id
			  where a.status='active' and b.status='failed'
			    and not exists (select 1 from affiliate_conversions c
			      join admin_settlement_review_holds h on h.business_id=c.business_id and h.is_active
			      where c.payout_batch_id=b.payout_batch_id)
		    and b.failure_reason not like 'provider_event:%'
			and b.attempted_at <= $1::timestamptz - interval '15 minutes'
		  order by b.attempted_at for update of b skip locked limit 1
		)
		update affiliate_payout_batches b set status='processing', attempted_at=$1, updated_at=$1
		from retryable where b.payout_batch_id=retryable.payout_batch_id
		returning b.payout_batch_id::text,b.affiliate_id::text,b.provider_recipient_ref,b.payout_reference,b.commission_minor
	`, now).Scan(&dispatch.PayoutBatchID, &dispatch.AffiliateID, &dispatch.RecipientCode, &dispatch.Reference, &dispatch.AmountMinor)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return ports.AffiliatePayoutDispatch{}, false, err
		}
		return dispatch, true, nil
	}
	if !isNoRows(err) {
		return ports.AffiliatePayoutDispatch{}, false, err
	}

	var affiliateID common.ID
	var recipient string
	err = tx.QueryRow(ctx, `
		select a.affiliate_id::text,p.provider_recipient_ref
		from affiliates a join affiliate_payout_profiles p on p.affiliate_id=a.affiliate_id
		where a.status='active' and p.provider_recipient_ref <> ''
		  and exists (select 1 from affiliate_conversions c where c.affiliate_id=a.affiliate_id
			    and c.payout_batch_id is null and (c.status='approved' or (c.status='pending' and c.hold_until <= $1::timestamptz))
			    and not exists (select 1 from admin_settlement_review_holds h where h.business_id=c.business_id and h.is_active))
		order by a.created_at for update of a skip locked limit 1
	`, now).Scan(&affiliateID, &recipient)
	if isNoRows(err) {
		return ports.AffiliatePayoutDispatch{}, false, nil
	}
	if err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}

	_, err = tx.Exec(ctx, `update affiliate_conversions set status='approved',approved_at=coalesce(approved_at,$2),updated_at=$2
		where affiliate_id=$1 and status='pending' and payout_batch_id is null and hold_until <= $2
		  and not exists (select 1 from admin_settlement_review_holds h where h.business_id=affiliate_conversions.business_id and h.is_active)`, affiliateID, now)
	if err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}
	rows, err := tx.Query(ctx, `select affiliate_conversion_id::text,gross_minor,commission_minor from affiliate_conversions
		where affiliate_id=$1 and status='approved' and payout_batch_id is null
		  and not exists (select 1 from admin_settlement_review_holds h where h.business_id=affiliate_conversions.business_id and h.is_active)
		order by approved_at nulls last,updated_at,affiliate_conversion_id for update`, affiliateID)
	if err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}
	var conversionIDs []string
	var gross, commission int64
	for rows.Next() {
		var id string
		var g, c int64
		if err := rows.Scan(&id, &g, &c); err != nil {
			rows.Close()
			return ports.AffiliatePayoutDispatch{}, false, err
		}
		conversionIDs = append(conversionIDs, id)
		gross += g
		commission += c
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}
	if len(conversionIDs) == 0 || commission <= 0 {
		return ports.AffiliatePayoutDispatch{}, false, nil
	}
	reference := "affiliate-" + batchID.String()
	_, err = tx.Exec(ctx, `insert into affiliate_payout_batches(payout_batch_id,affiliate_id,payout_mode,payout_reference,conversion_count,gross_minor,commission_minor,status,notes,provider_recipient_ref,attempted_at)
		values($1,$2,'paystack_transfer',$3,$4,$5,$6,'processing','Automatic payout after commission maturity',$7,$8)`, batchID, affiliateID, reference, len(conversionIDs), gross, commission, recipient, now)
	if err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}
	_, err = tx.Exec(ctx, `update affiliate_conversions set payout_batch_id=$1,updated_at=$3 where affiliate_conversion_id = any($2::uuid[])`, batchID, conversionIDs, now)
	if err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliatePayoutDispatch{}, false, err
	}
	return ports.AffiliatePayoutDispatch{PayoutBatchID: batchID, AffiliateID: affiliateID, RecipientCode: recipient, Reference: reference, AmountMinor: commission}, true, nil
}

func (repo AdminAuthRepository) RecordAffiliatePayoutAttempt(ctx context.Context, batchID common.ID, transferCode, status, failure string) error {
	normalized := strings.ToLower(strings.TrimSpace(status))
	if normalized == "success" {
		normalized = "settled"
	} else if failure != "" {
		normalized = "failed"
	} else {
		normalized = "pending"
	}
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err = setTenantBypass(ctx, tx); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `update affiliate_payout_batches set status=$2,provider_transfer_code=$3,failure_reason=$4,completed_at=case when $2='settled' then now() else null end,updated_at=now() where payout_batch_id=$1`, batchID, normalized, transferCode, failure)
	if err != nil {
		return err
	}
	if normalized == "settled" {
		_, err = tx.Exec(ctx, `update affiliate_conversions set status='settled',settled_at=coalesce(settled_at,now()),updated_at=now() where payout_batch_id=$1 and status='approved'`, batchID)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (repo AdminAuthRepository) ApplyAffiliateTransferEvent(ctx context.Context, reference, eventType, status string) (bool, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err = setTenantBypass(ctx, tx); err != nil {
		return false, err
	}
	var batchID common.ID
	err = tx.QueryRow(ctx, `select payout_batch_id::text from affiliate_payout_batches where payout_reference=$1 for update`, reference).Scan(&batchID)
	if isNoRows(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	normalized := strings.ToLower(strings.TrimSpace(status))
	if strings.HasSuffix(eventType, ".success") || normalized == "success" {
		normalized = "settled"
	} else if strings.HasSuffix(eventType, ".reversed") {
		normalized = "reversed"
	} else {
		normalized = "failed"
	}
	_, err = tx.Exec(ctx, `update affiliate_payout_batches set status=$2,failure_reason=case when $2='settled' then '' else $3 end,completed_at=now(),updated_at=now() where payout_batch_id=$1`, batchID, normalized, "provider_event:"+eventType)
	if err != nil {
		return false, err
	}
	if normalized == "settled" {
		_, err = tx.Exec(ctx, `update affiliate_conversions set status='settled',settled_at=coalesce(settled_at,now()),updated_at=now() where payout_batch_id=$1 and status='approved'`, batchID)
	} else {
		_, err = tx.Exec(ctx, `update affiliate_conversions set payout_batch_id=null,updated_at=now() where payout_batch_id=$1 and status='approved'`, batchID)
	}
	if err != nil {
		return false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func isNoRows(err error) bool { return err == pgx.ErrNoRows }
