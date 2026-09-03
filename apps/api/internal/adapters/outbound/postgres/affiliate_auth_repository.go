package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type AffiliateAuthRepository struct {
	pool *pgxpool.Pool
}

func NewAffiliateAuthRepository(pool *pgxpool.Pool) AffiliateAuthRepository {
	return AffiliateAuthRepository{pool: pool}
}

func (repo AffiliateAuthRepository) ActivateAffiliateAccount(
	ctx context.Context,
	input ports.ActivateAffiliateAccountInput,
) (ports.AffiliateAccountRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}

	record, err := scanAffiliateAccount(tx.QueryRow(ctx, `
		with valid_token as (
			select t.affiliate_activation_token_id, t.affiliate_account_id
			from affiliate_activation_tokens t
			join affiliate_accounts aa
				on aa.affiliate_account_id = t.affiliate_account_id
			join affiliates a on a.affiliate_id = aa.affiliate_id
			where t.token_hash = $1
				and t.consumed_at is null
				and t.expires_at > $3
				and aa.status = 'invited'
				and a.status = 'active'
			for update of t, aa
		),
		activated as (
			update affiliate_accounts aa
			set password_hash = $2,
				status = 'active',
				email_verified_at = $3,
				activated_at = $3,
				failed_login_count = 0,
				locked_until = null,
				updated_at = $3
			from valid_token
			where aa.affiliate_account_id = valid_token.affiliate_account_id
			returning aa.*
		),
		consumed as (
			update affiliate_activation_tokens t
			set consumed_at = $3
			from valid_token
			where t.affiliate_activation_token_id = valid_token.affiliate_activation_token_id
			returning t.affiliate_activation_token_id
		),
		consumed_marker as (select 1 from consumed)
		select
			activated.affiliate_account_id::text,
			activated.affiliate_id::text,
			activated.email,
			a.display_name,
			a.code,
			a.cookie_window_days,
			activated.status,
			activated.created_at,
			activated.updated_at
		from activated
		join affiliates a on a.affiliate_id = activated.affiliate_id
		join consumed_marker on true
		limit 1
	`, input.ActivationTokenHash, input.PasswordHash, input.ActivatedAt))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateAccountRecord{}, ErrNotFound
		}
		return ports.AffiliateAccountRecord{}, err
	}
	if _, err := tx.Exec(ctx, `
		update affiliate_activation_tokens
		set consumed_at = coalesce(consumed_at, $2)
		where affiliate_account_id = $1::uuid
			and consumed_at is null
	`, record.AccountID.String(), input.ActivatedAt); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) CreateAffiliateActivationToken(
	ctx context.Context,
	input ports.CreateAffiliateActivationTokenInput,
) (ports.AffiliateAccountRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	record, err := scanAffiliateAccount(tx.QueryRow(ctx, affiliateAccountQuery()+`
		where lower(aa.email) = lower($1)
			and aa.status = 'invited'
			and a.status = 'active'
		limit 1
		for update of aa
	`, input.Email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateAccountRecord{}, ErrNotFound
		}
		return ports.AffiliateAccountRecord{}, err
	}
	if _, err := tx.Exec(ctx, `
		update affiliate_activation_tokens
		set consumed_at = now()
		where affiliate_account_id = $1::uuid and consumed_at is null
	`, record.AccountID.String()); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	if _, err := tx.Exec(ctx, `
		insert into affiliate_activation_tokens (
			affiliate_activation_token_id, affiliate_account_id, token_hash, expires_at
		) values ($1::uuid, $2::uuid, $3, $4)
	`, input.TokenID.String(), record.AccountID.String(), input.TokenHash, input.ExpiresAt); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) FindAffiliateAccountByEmail(
	ctx context.Context,
	email string,
) (ports.AffiliateAccountCredentials, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateAccountCredentials{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateAccountCredentials{}, err
	}

	var record ports.AffiliateAccountCredentials
	var lockedUntil pgtype.Timestamptz
	err = tx.QueryRow(ctx, `
		select
			aa.affiliate_account_id::text,
			aa.affiliate_id::text,
			aa.email,
			a.display_name,
			a.code,
			a.cookie_window_days,
			aa.status,
			aa.created_at,
			aa.updated_at,
			aa.password_hash,
			aa.locked_until
		from affiliate_accounts aa
		join affiliates a on a.affiliate_id = aa.affiliate_id
		where lower(aa.email) = lower($1)
			and a.status = 'active'
		limit 1
	`, email).Scan(
		&record.AccountID,
		&record.AffiliateID,
		&record.Email,
		&record.DisplayName,
		&record.Code,
		&record.CookieWindowDays,
		&record.Status,
		&record.CreatedAt,
		&record.UpdatedAt,
		&record.PasswordHash,
		&lockedUntil,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateAccountCredentials{}, ErrNotFound
		}
		return ports.AffiliateAccountCredentials{}, err
	}
	record.LockedUntil = timestamptzPtr(lockedUntil)
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateAccountCredentials{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) FindAffiliateAccountByID(
	ctx context.Context,
	accountID common.ID,
) (ports.AffiliateAccountRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	record, err := scanAffiliateAccount(tx.QueryRow(ctx, affiliateAccountQuery()+`
		where aa.affiliate_account_id = $1::uuid
			and aa.status = 'active'
			and a.status = 'active'
	`, accountID.String()))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateAccountRecord{}, ErrNotFound
		}
		return ports.AffiliateAccountRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) CreateAffiliateRecoveryToken(
	ctx context.Context,
	input ports.CreateAffiliateRecoveryTokenInput,
) (ports.AffiliateAccountRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	record, err := scanAffiliateAccount(tx.QueryRow(ctx, `
		with account as (
			select aa.affiliate_account_id
			from affiliate_accounts aa
			join affiliates a on a.affiliate_id = aa.affiliate_id
			where lower(aa.email) = lower($2)
				and aa.status in ('invited', 'active', 'locked')
				and a.status = 'active'
			limit 1
		),
		invalidated as (
			update affiliate_recovery_tokens t
			set consumed_at = now()
			from account
			where t.affiliate_account_id = account.affiliate_account_id
				and t.consumed_at is null
			returning t.affiliate_recovery_token_id
		),
		created as (
			insert into affiliate_recovery_tokens (
				affiliate_recovery_token_id,
				affiliate_account_id,
				token_hash,
				expires_at
			)
			select $1::uuid, account.affiliate_account_id, $3, $4
			from account
			returning affiliate_account_id
		)
		select
			aa.affiliate_account_id::text,
			aa.affiliate_id::text,
			aa.email,
			a.display_name,
			a.code,
			a.cookie_window_days,
			aa.status,
			aa.created_at,
			aa.updated_at
		from created
		join affiliate_accounts aa
			on aa.affiliate_account_id = created.affiliate_account_id
		join affiliates a on a.affiliate_id = aa.affiliate_id
	`, input.TokenID.String(), input.Email, input.TokenHash, input.ExpiresAt))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateAccountRecord{}, ErrNotFound
		}
		return ports.AffiliateAccountRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateAccountRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) ResetAffiliatePassword(
	ctx context.Context,
	input ports.ResetAffiliatePasswordInput,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	var accountID string
	err = tx.QueryRow(ctx, `
		with valid_token as (
			select t.affiliate_recovery_token_id, t.affiliate_account_id
			from affiliate_recovery_tokens t
			where t.token_hash = $1
				and t.consumed_at is null
				and t.expires_at > $3
			for update
		),
		updated as (
			update affiliate_accounts aa
			set password_hash = $2,
				status = 'active',
				email_verified_at = coalesce(email_verified_at, $3),
				activated_at = coalesce(activated_at, $3),
				failed_login_count = 0,
				locked_until = null,
				updated_at = $3
			from valid_token
			where aa.affiliate_account_id = valid_token.affiliate_account_id
			returning aa.affiliate_account_id
		),
		consumed as (
			update affiliate_recovery_tokens t
			set consumed_at = $3
			from valid_token
			where t.affiliate_recovery_token_id =
				valid_token.affiliate_recovery_token_id
			returning t.affiliate_recovery_token_id
		),
		revoked as (
			update affiliate_refresh_sessions s
			set revoked_at = coalesce(s.revoked_at, $3)
			from updated, consumed
			where s.affiliate_account_id = updated.affiliate_account_id
			returning s.affiliate_refresh_session_id
		)
		select updated.affiliate_account_id::text
		from updated
		join consumed on true
	`, input.TokenHash, input.PasswordHash, input.ResetAt).Scan(&accountID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return tx.Commit(ctx)
}

func (repo AffiliateAuthRepository) RecordFailedAffiliateLogin(
	ctx context.Context,
	accountID common.ID,
	maxAttempts int,
	lockFor time.Duration,
) error {
	return repo.execBypass(ctx, `
		update affiliate_accounts
		set failed_login_count = case
				when failed_login_count + 1 >= $2 then 0
				else failed_login_count + 1
			end,
			status = case
				when failed_login_count + 1 >= $2 then 'locked'
				else status
			end,
			locked_until = case
				when failed_login_count + 1 >= $2
				then now() + make_interval(secs => $3)
				else locked_until
			end,
			updated_at = now()
		where affiliate_account_id = $1::uuid
	`, accountID.String(), maxAttempts, lockFor.Seconds())
}

func (repo AffiliateAuthRepository) ClearFailedAffiliateLogin(
	ctx context.Context,
	accountID common.ID,
) error {
	return repo.execBypass(ctx, `
		update affiliate_accounts
		set failed_login_count = 0,
			status = case when status = 'locked' then 'active' else status end,
			locked_until = null,
			updated_at = now()
		where affiliate_account_id = $1::uuid
	`, accountID.String())
}

func (repo AffiliateAuthRepository) RecordAffiliateLogin(
	ctx context.Context,
	accountID common.ID,
) error {
	return repo.execBypass(ctx, `
		update affiliate_accounts
		set last_login_at = now(), updated_at = now()
		where affiliate_account_id = $1::uuid
	`, accountID.String())
}

func (repo AffiliateAuthRepository) CreateAffiliateSession(
	ctx context.Context,
	input ports.CreateAffiliateSessionInput,
) error {
	return repo.execBypass(ctx, `
		insert into affiliate_refresh_sessions (
			affiliate_refresh_session_id,
			affiliate_account_id,
			refresh_token_hash,
			user_agent,
			ip_hash,
			expires_at
		)
		values ($1::uuid, $2::uuid, $3, $4, $5, $6)
	`, input.SessionID.String(), input.AccountID.String(), input.RefreshTokenHash,
		input.UserAgent, input.IPHash, input.ExpiresAt)
}

func (repo AffiliateAuthRepository) FindAffiliateSession(
	ctx context.Context,
	refreshTokenHash string,
) (ports.AffiliateSessionWithAccount, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateSessionWithAccount{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateSessionWithAccount{}, err
	}

	var session ports.AffiliateSessionWithAccount
	err = tx.QueryRow(ctx, `
		select
			s.affiliate_refresh_session_id::text,
			aa.affiliate_account_id::text,
			aa.affiliate_id::text,
			aa.email,
			a.display_name,
			a.code,
			aa.status,
			(s.revoked_at is not null),
			s.expires_at
		from affiliate_refresh_sessions s
		join affiliate_accounts aa
			on aa.affiliate_account_id = s.affiliate_account_id
		join affiliates a on a.affiliate_id = aa.affiliate_id
		where s.refresh_token_hash = $1
		limit 1
	`, refreshTokenHash).Scan(
		&session.SessionID,
		&session.AccountID,
		&session.AffiliateID,
		&session.Email,
		&session.DisplayName,
		&session.Code,
		&session.AccountStatus,
		&session.Revoked,
		&session.ExpiresAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.AffiliateSessionWithAccount{}, ErrNotFound
		}
		return ports.AffiliateSessionWithAccount{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateSessionWithAccount{}, err
	}
	return session, nil
}

func (repo AffiliateAuthRepository) RevokeAffiliateSession(
	ctx context.Context,
	sessionID common.ID,
) error {
	return repo.execBypass(ctx, `
		update affiliate_refresh_sessions
		set revoked_at = coalesce(revoked_at, now())
		where affiliate_refresh_session_id = $1::uuid
	`, sessionID.String())
}

//nolint:funlen // long by construction: one large SQL statement plus its row scan. Splitting it would hide the query from its mapping, not simplify it.
func (repo AffiliateAuthRepository) GetAffiliateDashboard(
	ctx context.Context,
	input ports.AffiliateDashboardQuery,
) (ports.AffiliateDashboardRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	var record ports.AffiliateDashboardRecord
	err = tx.QueryRow(ctx, `
		with period_clicks as (
			select count(*)::bigint as total
			from affiliate_clicks
			where affiliate_id = $1::uuid
				and clicked_at >= $2
				and clicked_at < $3
		),
		period_signups as (
			select
				count(*) filter (
					where subject_type = 'customer' and status = 'qualified'
				)::bigint as customers,
				count(*) filter (
					where subject_type = 'business' and status = 'qualified'
				)::bigint as businesses
			from affiliate_signups
			where affiliate_id = $1::uuid
				and qualified_at >= $2
				and qualified_at < $3
		),
		period_conversions as (
			select
				count(*) filter (
					where conversion_type = 'purchase'
				)::bigint as purchases,
				count(*) filter (
					where conversion_type = 'subscription_payment'
				)::bigint as paid_plan_signups,
				coalesce(sum(gross_minor) filter (
					where conversion_type = 'purchase'
				), 0)::bigint as gross_minor,
				coalesce(sum(commission_minor) filter (
					where status = 'pending' and (hold_until > now() or exists (
						select 1 from admin_settlement_review_holds hold
						where hold.business_id = affiliate_conversions.business_id and hold.is_active
					))
				), 0)::bigint as pending_minor,
				coalesce(sum(commission_minor) filter (
					where (status = 'approved' or (status = 'pending' and hold_until <= now()))
						and not exists (select 1 from admin_settlement_review_holds hold
							where hold.business_id = affiliate_conversions.business_id and hold.is_active)
				), 0)::bigint as available_minor,
				coalesce(sum(commission_minor) filter (
					where status = 'settled'
				), 0)::bigint as paid_minor,
				coalesce(sum(commission_minor) filter (
					where status = 'reversed'
				), 0)::bigint as reversed_minor
			from affiliate_conversions
			where affiliate_id = $1::uuid
				and created_at >= $2
				and created_at < $3
		),
		lifetime as (
			select coalesce(sum(commission_minor) filter (
				where status in ('pending', 'approved', 'settled')
			), 0)::bigint as earnings_minor
			from affiliate_conversions
			where affiliate_id = $1::uuid
		)
		select
			period_clicks.total,
			period_signups.customers,
			period_signups.businesses,
			period_conversions.paid_plan_signups,
			period_conversions.purchases,
			period_conversions.gross_minor,
			period_conversions.pending_minor,
			period_conversions.available_minor,
			period_conversions.paid_minor,
			period_conversions.reversed_minor,
			lifetime.earnings_minor
		from period_clicks, period_signups, period_conversions, lifetime
	`, input.AffiliateID.String(), input.From, input.To).Scan(
		&record.ClickCount,
		&record.CustomerSignupCount,
		&record.BusinessSignupCount,
		&record.PaidPlanSignupCount,
		&record.PurchaseCount,
		&record.GrossEligibleMinor,
		&record.PendingCommissionMinor,
		&record.AvailableCommissionMinor,
		&record.PaidCommissionMinor,
		&record.ReversedCommissionMinor,
		&record.LifetimeEarningsMinor,
	)
	if err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	err = tx.QueryRow(ctx, `
		with referrals as (
			select signup.business_id,
				case
					when subscription.status = 'active'
						and subscription.current_period_end > now()
						and current_plan.monthly_fee_minor > 0 then 'active'
					when exists (
						select 1 from affiliate_conversions conversion
						where conversion.affiliate_id = $1::uuid
						  and conversion.business_id = signup.business_id
						  and conversion.conversion_type = 'subscription_payment'
						  and conversion.commission_minor > 0
					) then 'inactive'
					else 'not_activated'
				end as state
			from affiliate_signups signup
			left join business_subscriptions subscription
				on subscription.business_id = signup.business_id
			left join plans current_plan on current_plan.plan_id = subscription.plan_id
			where signup.affiliate_id = $1::uuid
			  and signup.subject_type = 'business'
			  and signup.status = 'qualified'
		), active_count as (
			select count(*)::bigint as total from referrals where state = 'active'
		), next_milestone as (
			select threshold, title from partner_milestones
			where status = 'active' and threshold > (select total from active_count)
			order by threshold limit 1
		), invites as (
			select count(*)::bigint as total from partner_invitations
			where inviter_affiliate_id = $1::uuid and accepted_at is not null
		)
		select
			count(*) filter (where state = 'active')::bigint,
			count(*) filter (where state = 'inactive')::bigint,
			count(*) filter (where state = 'not_activated')::bigint,
			coalesce((select threshold from next_milestone), 0),
			coalesce((select title from next_milestone), ''),
			(select total from invites)
		from referrals
	`, input.AffiliateID.String()).Scan(
		&record.ActiveReferralCount, &record.InactiveReferralCount,
		&record.NotActivatedCount, &record.NextMilestoneThreshold,
		&record.NextMilestoneTitle, &record.PartnersInvitedCount,
	)
	if err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	_, err = tx.Exec(ctx, `
		insert into partner_milestone_achievements (
			affiliate_id, partner_milestone_id
		)
		select $1::uuid, milestone.partner_milestone_id
		from partner_milestones milestone
		where milestone.status = 'active'
		  and milestone.threshold <= $2
		on conflict (affiliate_id, partner_milestone_id) do nothing
	`, input.AffiliateID.String(), record.ActiveReferralCount)
	if err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	rows, err := tx.Query(ctx, `
		select achievement.partner_milestone_achievement_id::text,
			milestone.threshold, milestone.title, milestone.reward_description,
			achievement.reward_status, achievement.achieved_at
		from partner_milestone_achievements achievement
		join partner_milestones milestone
			on milestone.partner_milestone_id = achievement.partner_milestone_id
		where achievement.affiliate_id = $1::uuid
		order by milestone.threshold desc
	`, input.AffiliateID.String())
	if err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	defer rows.Close()
	record.MilestoneAchievements = []ports.PartnerMilestoneAchievementRecord{}
	for rows.Next() {
		var achievement ports.PartnerMilestoneAchievementRecord
		if err := rows.Scan(
			&achievement.AchievementID, &achievement.Threshold,
			&achievement.Title, &achievement.RewardDescription,
			&achievement.RewardStatus, &achievement.AchievedAt,
		); err != nil {
			return ports.AffiliateDashboardRecord{}, err
		}
		record.MilestoneAchievements = append(record.MilestoneAchievements, achievement)
	}
	if err := rows.Err(); err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateDashboardRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) ListPartnerReferrals(
	ctx context.Context,
	affiliateID common.ID,
) ([]ports.PartnerReferralRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
		select business.handle,
			case
					when subscription.status = 'active'
						and subscription.current_period_end > now()
						and current_plan.monthly_fee_minor > 0 then 'active'
				when exists (
					select 1 from affiliate_conversions conversion
					where conversion.affiliate_id = $1::uuid
					  and conversion.business_id = signup.business_id
						  and conversion.conversion_type = 'subscription_payment'
						  and conversion.commission_minor > 0
				) then 'inactive'
				else 'not_activated'
			end
		from affiliate_signups signup
		join businesses business on business.business_id = signup.business_id
		left join business_subscriptions subscription
			on subscription.business_id = signup.business_id
		left join plans current_plan on current_plan.plan_id = subscription.plan_id
		where signup.affiliate_id = $1::uuid
		  and signup.subject_type = 'business'
		  and signup.status = 'qualified'
		order by signup.qualified_at desc
	`, affiliateID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.PartnerReferralRecord{}
	for rows.Next() {
		var record ports.PartnerReferralRecord
		if err := rows.Scan(&record.Handle, &record.Status); err != nil {
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

func (repo AffiliateAuthRepository) ListAffiliateConversions(
	ctx context.Context,
	input ports.AffiliateLedgerQuery,
) ([]ports.AffiliateConversionRecord, error) {
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
			c.affiliate_conversion_id::text,
			c.conversion_type,
			c.gross_minor,
			c.commission_minor,
			c.status,
			c.created_at
		from affiliate_conversions c
		where c.affiliate_id = $1::uuid
			and ($2::text = '' or c.status = $2)
			and ($3::text = '' or c.conversion_type = $3)
			and (
				$4::text = ''
				or (c.created_at, c.affiliate_conversion_id) < (
					select previous.created_at,
						previous.affiliate_conversion_id
					from affiliate_conversions previous
					where previous.affiliate_conversion_id = $4::uuid
						and previous.affiliate_id = $1::uuid
				)
			)
		order by c.created_at desc, c.affiliate_conversion_id desc
		limit $5
	`, input.AffiliateID.String(), input.Status, input.Type,
		optionalID(input.Cursor), input.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.AffiliateConversionRecord{}
	for rows.Next() {
		var record ports.AffiliateConversionRecord
		if err := rows.Scan(
			&record.ConversionID,
			&record.ConversionType,
			&record.GrossMinor,
			&record.CommissionMinor,
			&record.Status,
			&record.OccurredAt,
		); err != nil {
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

func (repo AffiliateAuthRepository) ListAffiliatePayouts(
	ctx context.Context,
	input ports.AffiliateLedgerQuery,
) ([]ports.AffiliatePayoutRecord, error) {
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
			p.payout_batch_id::text,
			p.payout_mode,
			p.payout_reference,
			p.conversion_count,
			p.gross_minor,
			p.commission_minor,
			p.status,
			p.created_at
		from affiliate_payout_batches p
		where p.affiliate_id = $1::uuid
			and (
				$2::text = ''
				or (p.created_at, p.payout_batch_id) < (
					select previous.created_at, previous.payout_batch_id
					from affiliate_payout_batches previous
					where previous.payout_batch_id = $2::uuid
						and previous.affiliate_id = $1::uuid
				)
			)
		order by p.created_at desc, p.payout_batch_id desc
		limit $3
	`, input.AffiliateID.String(), optionalID(input.Cursor), input.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.AffiliatePayoutRecord{}
	for rows.Next() {
		var record ports.AffiliatePayoutRecord
		if err := rows.Scan(
			&record.PayoutID,
			&record.PayoutMode,
			&record.PayoutReference,
			&record.ConversionCount,
			&record.GrossMinor,
			&record.CommissionMinor,
			&record.Status,
			&record.CreatedAt,
		); err != nil {
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

func (repo AffiliateAuthRepository) execBypass(
	ctx context.Context,
	query string,
	args ...any,
) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, query, args...); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func optionalID(value *common.ID) string {
	if value == nil {
		return ""
	}
	return value.String()
}

func affiliateAccountQuery() string {
	return `
		select
			aa.affiliate_account_id::text,
			aa.affiliate_id::text,
			aa.email,
			a.display_name,
			a.code,
			a.cookie_window_days,
			aa.status,
			aa.created_at,
			aa.updated_at
		from affiliate_accounts aa
		join affiliates a on a.affiliate_id = aa.affiliate_id
	`
}

func scanAffiliateAccount(row pgx.Row) (ports.AffiliateAccountRecord, error) {
	var record ports.AffiliateAccountRecord
	err := row.Scan(
		&record.AccountID,
		&record.AffiliateID,
		&record.Email,
		&record.DisplayName,
		&record.Code,
		&record.CookieWindowDays,
		&record.Status,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	return record, err
}
