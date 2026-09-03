package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AdminAuthRepository) ListAdminAffiliates(ctx context.Context) ([]ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, adminAffiliatesQuery()+`
		order by
			case a.status when 'pending_review' then 1 when 'active' then 2 when 'paused' then 3 else 4 end,
			a.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateRecord{}
	for rows.Next() {
		record, err := scanAdminAffiliateRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) ListAdminAffiliateAttribution(ctx context.Context) ([]ports.AdminAffiliateAttributionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		with click_stats as (
			select
				affiliate_id,
				count(*)::bigint as click_count,
				max(clicked_at) as last_clicked_at
			from affiliate_clicks
			group by affiliate_id
		),
		conversion_stats as (
			select
				affiliate_id,
				count(*) filter (where conversion_type <> 'adjustment')::bigint as conversion_count,
				count(*) filter (where status = 'pending' and conversion_type <> 'adjustment')::bigint as pending_count,
				count(*) filter (where status = 'approved' and conversion_type <> 'adjustment')::bigint as approved_count,
				count(*) filter (where status = 'settled' and conversion_type <> 'adjustment')::bigint as settled_count,
				count(*) filter (where status = 'reversed' and conversion_type <> 'adjustment')::bigint as reversed_count,
				coalesce(sum(gross_minor), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor), 0)::bigint as commission_minor,
				max(updated_at) as last_conversion_at
			from affiliate_conversions
			group by affiliate_id
		), referral_states as (
			select signup.affiliate_id,
				case
					when subscription.status = 'active' and subscription.current_period_end > now() and plan.monthly_fee_minor > 0 then 'active'
					when exists (
						select 1 from affiliate_conversions conversion
						where conversion.affiliate_id = signup.affiliate_id and conversion.business_id = signup.business_id
							and conversion.conversion_type = 'subscription_payment' and conversion.commission_minor > 0
					) then 'inactive'
					else 'not_activated'
				end as state
			from affiliate_signups signup
			left join business_subscriptions subscription on subscription.business_id = signup.business_id
			left join plans plan on plan.plan_id = subscription.plan_id
			where signup.subject_type = 'business' and signup.status = 'qualified'
		), referral_stats as (
			select affiliate_id,
				count(*) filter (where state = 'active')::bigint as active_count,
				count(*) filter (where state = 'inactive')::bigint as inactive_count,
				count(*) filter (where state = 'not_activated')::bigint as not_activated_count
			from referral_states group by affiliate_id
		)
		select
			a.affiliate_id::text,
			a.code,
			a.display_name,
			coalesce(click_stats.click_count, 0)::bigint,
			coalesce(conversion_stats.conversion_count, 0)::bigint,
			coalesce(conversion_stats.pending_count, 0)::bigint,
			coalesce(conversion_stats.approved_count, 0)::bigint,
			coalesce(conversion_stats.settled_count, 0)::bigint,
			coalesce(conversion_stats.reversed_count, 0)::bigint,
			coalesce(referral_stats.active_count, 0)::bigint,
			coalesce(referral_stats.inactive_count, 0)::bigint,
			coalesce(referral_stats.not_activated_count, 0)::bigint,
			coalesce(conversion_stats.gross_minor, 0)::bigint,
			coalesce(conversion_stats.commission_minor, 0)::bigint,
			greatest(
				a.updated_at,
				coalesce(click_stats.last_clicked_at, 'epoch'::timestamptz),
				coalesce(conversion_stats.last_conversion_at, 'epoch'::timestamptz)
			)
		from affiliates a
		left join click_stats on click_stats.affiliate_id = a.affiliate_id
		left join conversion_stats on conversion_stats.affiliate_id = a.affiliate_id
		left join referral_stats on referral_stats.affiliate_id = a.affiliate_id
		order by
			coalesce(conversion_stats.conversion_count, 0) desc,
			coalesce(click_stats.click_count, 0) desc,
			a.updated_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []ports.AdminAffiliateAttributionRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateAttributionRecord
		var lastActivityAt time.Time
		if err := rows.Scan(
			&record.AffiliateID,
			&record.Code,
			&record.DisplayName,
			&record.ClickCount,
			&record.ConversionCount,
			&record.PendingConversionCount,
			&record.ApprovedConversionCount,
			&record.SettledConversionCount,
			&record.ReversedConversionCount,
			&record.ActiveReferralCount,
			&record.InactiveReferralCount,
			&record.NotActivatedCount,
			&record.GrossMinor,
			&record.CommissionMinor,
			&lastActivityAt,
		); err != nil {
			return nil, err
		}
		record.LastActivityAt = &lastActivityAt
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	conversions, err := listAdminAffiliateConversions(ctx, tx)
	if err != nil {
		return nil, err
	}
	payouts, err := listAdminAffiliatePayouts(ctx, tx)
	if err != nil {
		return nil, err
	}
	invitations, err := listAdminAffiliateInvitations(ctx, tx)
	if err != nil {
		return nil, err
	}
	achievements, err := listAdminAffiliateMilestoneAchievements(ctx, tx)
	if err != nil {
		return nil, err
	}
	for index := range records {
		records[index].RecentConversions = conversions[records[index].AffiliateID]
		records[index].RecentPayouts = payouts[records[index].AffiliateID]
		records[index].Invitations = invitations[records[index].AffiliateID]
		records[index].MilestoneAchievements = achievements[records[index].AffiliateID]
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return records, nil
}

func listAdminAffiliateInvitations(ctx context.Context, tx pgx.Tx) (map[common.ID][]ports.AdminAffiliateInvitationRecord, error) {
	rows, err := tx.Query(ctx, `
		select invitation.partner_invitation_id::text, invitation.inviter_affiliate_id::text,
			invitation.invitee_email, coalesce(invitation.accepted_affiliate_id::text, ''),
			coalesce(accepted.display_name, ''), invitation.created_at, invitation.accepted_at
		from partner_invitations invitation
		left join affiliates accepted on accepted.affiliate_id=invitation.accepted_affiliate_id
		order by invitation.inviter_affiliate_id, invitation.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := map[common.ID][]ports.AdminAffiliateInvitationRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateInvitationRecord
		var acceptedAt pgtype.Timestamptz
		if err := rows.Scan(&record.InvitationID, &record.InviterAffiliateID, &record.InviteeEmail,
			&record.AcceptedAffiliateID, &record.AcceptedDisplayName, &record.CreatedAt, &acceptedAt); err != nil {
			return nil, err
		}
		record.AcceptedAt = timestamptzPtr(acceptedAt)
		records[record.InviterAffiliateID] = append(records[record.InviterAffiliateID], record)
	}
	return records, rows.Err()
}

func listAdminAffiliateMilestoneAchievements(ctx context.Context, tx pgx.Tx) (map[common.ID][]ports.AdminAffiliateMilestoneAchievementRecord, error) {
	rows, err := tx.Query(ctx, `
		select achievement.partner_milestone_achievement_id::text,
			achievement.affiliate_id::text, milestone.threshold, milestone.title,
			milestone.reward_description, achievement.reward_status,
			achievement.fulfilment_note, achievement.achieved_at, achievement.fulfilled_at
		from partner_milestone_achievements achievement
		join partner_milestones milestone on milestone.partner_milestone_id=achievement.partner_milestone_id
		order by achievement.achieved_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := map[common.ID][]ports.AdminAffiliateMilestoneAchievementRecord{}
	for rows.Next() {
		var record ports.AdminAffiliateMilestoneAchievementRecord
		if err := rows.Scan(&record.AchievementID, &record.AffiliateID, &record.Threshold, &record.Title,
			&record.RewardDescription, &record.RewardStatus, &record.FulfilmentNote, &record.AchievedAt, &record.FulfilledAt); err != nil {
			return nil, err
		}
		records[record.AffiliateID] = append(records[record.AffiliateID], record)
	}
	return records, rows.Err()
}

func (repo AdminAuthRepository) UpdateAdminAffiliateMilestoneAchievement(ctx context.Context, input ports.UpdateAdminAffiliateMilestoneAchievementInput) (ports.AdminAffiliateMilestoneAchievementRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateMilestoneAchievementRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateMilestoneAchievementRecord{}, err
	}
	row := tx.QueryRow(ctx, `
		update partner_milestone_achievements achievement
		set reward_status=$2, fulfilment_note=$3,
			fulfilled_at=case when $2='fulfilled' then coalesce(fulfilled_at, now()) else null end
		from partner_milestones milestone
		where achievement.partner_milestone_achievement_id=$1::uuid
		  and milestone.partner_milestone_id=achievement.partner_milestone_id
		returning achievement.partner_milestone_achievement_id::text,
			achievement.affiliate_id::text, milestone.threshold, milestone.title,
			milestone.reward_description, achievement.reward_status,
			achievement.fulfilment_note, achievement.achieved_at, achievement.fulfilled_at
	`, input.AchievementID.String(), input.RewardStatus, input.FulfilmentNote)
	var record ports.AdminAffiliateMilestoneAchievementRecord
	if err := row.Scan(&record.AchievementID, &record.AffiliateID, &record.Threshold, &record.Title,
		&record.RewardDescription, &record.RewardStatus, &record.FulfilmentNote, &record.AchievedAt, &record.FulfilledAt); err != nil {
		return ports.AdminAffiliateMilestoneAchievementRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateMilestoneAchievementRecord{}, err
	}
	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminAffiliateConversionStatus(
	ctx context.Context,
	input ports.UpdateAdminAffiliateConversionStatusInput,
) (ports.AdminAffiliateConversionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	current, err := queryAdminAffiliateConversion(ctx, tx, input.ConversionID.String())
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	if !validAffiliateConversionTransition(current.Status, input.Status) {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
	}
	if current.Status == "settled" && input.Status == "reversed" {
		if current.ConversionType == "adjustment" {
			return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
		}
		var adjustmentID common.ID
		err = tx.QueryRow(ctx, `
			insert into affiliate_conversions(
				affiliate_id,affiliate_programme_id,programme_owner_type,funding_source,
				business_id,conversion_type,gross_minor,commission_minor,
				commission_model,commission_rate,attribution_model,status,approved_at,
				source_conversion_id,adjustment_event_signature,reversal_reason,metadata
			)
			select affiliate_id,affiliate_programme_id,programme_owner_type,funding_source,
				business_id,'adjustment',-gross_minor,-commission_minor,
				commission_model,commission_rate,attribution_model,'approved',now(),
				affiliate_conversion_id,'admin-reversal:' || affiliate_conversion_id::text,$2,
				jsonb_build_object('source','admin_post_payout_adjustment',
					'admin_status_by',$3::text,'admin_status_at',now(),
					'adjustment_reason',$2::text)
			from affiliate_conversions where affiliate_conversion_id=$1::uuid
			on conflict (adjustment_event_signature)
				where conversion_type='adjustment' do update set updated_at=affiliate_conversions.updated_at
			returning affiliate_conversion_id::text
		`, input.ConversionID.String(), input.Reason, input.ActorAdminUser.String()).Scan(&adjustmentID)
		if err != nil {
			return ports.AdminAffiliateConversionRecord{}, err
		}
		record, err := queryAdminAffiliateConversion(ctx, tx, adjustmentID.String())
		if err != nil {
			return ports.AdminAffiliateConversionRecord{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return ports.AdminAffiliateConversionRecord{}, err
		}
		return record, nil
	}

	if _, err := tx.Exec(ctx, `
		update affiliate_conversions
		set status = case
				when $2 = 'held' then 'held'
				when $2 = 'released' then coalesce(pre_hold_status, 'pending')
				else $2
			end,
			pre_hold_status = case
				when $2 = 'held' then status
				when $2 = 'released' then null
				else pre_hold_status
			end,
			hold_reason = case
				when $2 = 'held' then $3
				when $2 = 'released' then ''
				else hold_reason
			end,
			hold_placed_at = case
				when $2 = 'held' then now()
				when $2 = 'released' then null
				else hold_placed_at
			end,
			hold_released_at = case
				when $2 = 'released' then now()
				else hold_released_at
			end,
			held_by_admin_user_id = case
				when $2 = 'held' then $4::uuid
				when $2 = 'released' then null
				else held_by_admin_user_id
			end,
			hold_released_by_admin_user_id = case
				when $2 = 'released' then $4::uuid
				else hold_released_by_admin_user_id
			end,
			approved_at = case
				when $2 = 'approved' then coalesce(approved_at, now())
				else approved_at
			end,
			settled_at = case
				when $2 = 'settled' then coalesce(settled_at, now())
				else settled_at
			end,
			reversed_at = case
				when $2 = 'reversed' then coalesce(reversed_at, now())
				else reversed_at
			end,
			reversal_reason = case
				when $2 = 'reversed' then $3
				else reversal_reason
			end,
			metadata = metadata || jsonb_build_object(
				'admin_status_note', $3::text,
				'admin_status_by', $4::text,
				'admin_status_at', now()
			),
			updated_at = now()
		where affiliate_conversion_id = $1::uuid
	`, input.ConversionID.String(), input.Status, input.Reason, input.ActorAdminUser.String()); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	record, err := queryAdminAffiliateConversion(ctx, tx, input.ConversionID.String())
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminAffiliatePayout(
	ctx context.Context,
	input ports.CreateAdminAffiliatePayoutInput,
) (ports.AdminAffiliatePayoutRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	record, err := scanAdminAffiliatePayoutRecord(tx.QueryRow(ctx, `
		with matured as (
			update affiliate_conversions
			set status = 'approved', approved_at = coalesce(approved_at, now()),
				updated_at = now(),
				metadata = metadata || jsonb_build_object('matured_automatically_at', now())
				where affiliate_id = $2::uuid and status = 'pending'
				  and hold_until <= now()
				  and not exists (select 1 from admin_settlement_review_holds hold where hold.business_id=affiliate_conversions.business_id and hold.is_active)
			returning affiliate_conversion_id
		), affiliate as (
			select
				affiliate_id,
				display_name,
				payout_mode,
				payout_reference
			from affiliates cross join (select count(*) from matured) maturity
			where affiliate_id = $2::uuid
				and status <> 'archived'
		),
		eligible as (
			select
				affiliate_conversion_id,
				gross_minor,
				commission_minor
			from affiliate_conversions
				where affiliate_id = $2::uuid
					and status = 'approved'
					and not exists (select 1 from admin_settlement_review_holds hold where hold.business_id=affiliate_conversions.business_id and hold.is_active)
			order by approved_at nulls last, updated_at, affiliate_conversion_id
			for update
		),
		totals as (
			select
				count(*)::int as conversion_count,
				coalesce(sum(gross_minor), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor), 0)::bigint as commission_minor
			from eligible
			having count(*) > 0 and sum(commission_minor) > 0
		),
		inserted as (
			insert into affiliate_payout_batches (
				payout_batch_id,
				affiliate_id,
				payout_mode,
				payout_reference,
				conversion_count,
				gross_minor,
				commission_minor,
				status,
				notes,
				created_by_admin_user_id
			)
			select
				$1::uuid,
				affiliate.affiliate_id,
				affiliate.payout_mode,
				coalesce(nullif($3::text, ''), affiliate.payout_reference),
				totals.conversion_count,
				totals.gross_minor,
				totals.commission_minor,
				'settled',
				$4::text,
				$5::uuid
			from affiliate
			join totals on true
			returning *
		),
		updated as (
			update affiliate_conversions ac
			set status = 'settled',
				settled_at = coalesce(settled_at, now()),
				payout_batch_id = (select payout_batch_id from inserted),
				metadata = metadata || jsonb_build_object(
					'payout_batch_id', (select payout_batch_id::text from inserted),
					'payout_reference', (select payout_reference from inserted),
					'payout_reconciled_by', $5::text,
					'payout_reconciled_at', now(),
					'payout_note', $4::text
				),
				updated_at = now()
			from eligible
			where ac.affiliate_conversion_id = eligible.affiliate_conversion_id
			returning 1
		)
		select
			inserted.payout_batch_id::text,
			inserted.affiliate_id::text,
			affiliate.display_name,
			inserted.payout_mode,
			inserted.payout_reference,
			inserted.conversion_count,
			inserted.gross_minor,
			inserted.commission_minor,
			inserted.status,
			inserted.notes,
			inserted.created_at,
			inserted.updated_at
		from inserted
		join affiliate on affiliate.affiliate_id = inserted.affiliate_id
	`, input.PayoutBatchID.String(),
		input.AffiliateID.String(),
		input.PayoutReference,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (repo AdminAuthRepository) CreateAdminAffiliate(
	ctx context.Context,
	input ports.CreateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with inserted as (
			insert into affiliates (
				affiliate_id,
				entity_type,
				code,
				display_name,
				contact_name,
				email,
				phone,
				region,
				website_url,
				commission_model,
				commission_rate,
				purchase_commission_bps,
				first_paid_plan_commission_bps,
				cookie_window_days,
				payout_mode,
				payout_reference,
				status,
				notes,
				created_by_admin_user_id,
				updated_by_admin_user_id
			)
			values (
				$1::uuid,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				$11,
				$12,
				$13,
				$14,
				$15,
				$16,
				$17,
				$18,
				$19::uuid,
				$19::uuid
			)
			returning *
		)
		`+adminAffiliateSelect("inserted")+`
	`, input.AffiliateID.String(),
		input.EntityType,
		input.Code,
		input.DisplayName,
		input.ContactName,
		input.Email,
		input.Phone,
		input.Region,
		input.WebsiteURL,
		input.CommissionModel,
		input.CommissionRate,
		input.PurchaseCommissionBPS,
		input.FirstPaidPlanCommissionBPS,
		input.CookieWindowDays,
		input.PayoutMode,
		input.PayoutReference,
		input.Status,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) UpdateAdminAffiliate(
	ctx context.Context,
	input ports.UpdateAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with updated as (
			update affiliates
			set entity_type = $2,
				code = $3,
				display_name = $4,
				contact_name = $5,
				email = $6,
				phone = $7,
				region = $8,
				website_url = $9,
				commission_model = $10,
				commission_rate = $11,
				purchase_commission_bps = $12,
				first_paid_plan_commission_bps = $13,
				cookie_window_days = $14,
				payout_mode = $15,
				payout_reference = $16,
				status = $17,
				notes = $18,
				updated_by_admin_user_id = $19::uuid,
				updated_at = now()
			where affiliate_id = $1::uuid
				and status <> 'archived'
			returning *
		)
		`+adminAffiliateSelect("updated")+`
	`, input.AffiliateID.String(),
		input.EntityType,
		input.Code,
		input.DisplayName,
		input.ContactName,
		input.Email,
		input.Phone,
		input.Region,
		input.WebsiteURL,
		input.CommissionModel,
		input.CommissionRate,
		input.PurchaseCommissionBPS,
		input.FirstPaidPlanCommissionBPS,
		input.CookieWindowDays,
		input.PayoutMode,
		input.PayoutReference,
		input.Status,
		input.Notes,
		input.ActorAdminUser.String(),
	))
	if err != nil {
		if affiliateCodeTaken(err) {
			return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (repo AdminAuthRepository) ArchiveAdminAffiliate(
	ctx context.Context,
	input ports.ArchiveAdminAffiliateInput,
) (ports.AdminAffiliateRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := scanAdminAffiliateRecord(tx.QueryRow(ctx, `
		with updated as (
			update affiliates
			set status = 'archived',
				updated_by_admin_user_id = $2::uuid,
				updated_at = now()
			where affiliate_id = $1::uuid
			returning *
		)
		`+adminAffiliateSelect("updated")+`
	`, input.AffiliateID.String(), input.ActorAdminUser.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AdminAffiliateRecord{}, ErrNotFound
		}
		return ports.AdminAffiliateRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}
