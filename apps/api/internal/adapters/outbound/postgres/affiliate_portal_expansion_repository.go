package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (repo AffiliateAuthRepository) ListAffiliateCampaignLinks(ctx context.Context, affiliateID common.ID) ([]ports.AffiliateCampaignLinkRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
		select campaign_link_id::text, affiliate_id::text, name, slug,
			destination_url, utm_campaign, created_at
		from affiliate_campaign_links
		where affiliate_id = $1::uuid
		order by created_at desc
	`, affiliateID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.AffiliateCampaignLinkRecord{}
	for rows.Next() {
		var record ports.AffiliateCampaignLinkRecord
		if err := rows.Scan(&record.CampaignLinkID, &record.AffiliateID,
			&record.Name, &record.Slug, &record.DestinationURL,
			&record.UTMCampaign, &record.CreatedAt); err != nil {
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

func (repo AffiliateAuthRepository) CreateAffiliateCampaignLink(
	ctx context.Context,
	input ports.CreateAffiliateCampaignLinkInput) (ports.AffiliateCampaignLinkRecord,
	error,
) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateCampaignLinkRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateCampaignLinkRecord{}, err
	}
	var record ports.AffiliateCampaignLinkRecord
	err = tx.QueryRow(ctx, `
		insert into affiliate_campaign_links (
			campaign_link_id, affiliate_id, name, slug,
			destination_url, utm_campaign
		) values ($1::uuid, $2::uuid, $3, $4, $5, $6)
		returning campaign_link_id::text, affiliate_id::text, name, slug,
			destination_url, utm_campaign, created_at
	`, input.CampaignLinkID.String(), input.AffiliateID.String(), input.Name,
		input.Slug, input.DestinationURL, input.UTMCampaign).Scan(
		&record.CampaignLinkID, &record.AffiliateID, &record.Name,
		&record.Slug, &record.DestinationURL, &record.UTMCampaign,
		&record.CreatedAt,
	)
	if err != nil {
		return ports.AffiliateCampaignLinkRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateCampaignLinkRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) GetAffiliatePayoutProfile(ctx context.Context, affiliateID common.ID) (ports.AffiliatePayoutProfileRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	var record ports.AffiliatePayoutProfileRecord
	var last4 string
	err = tx.QueryRow(ctx, `
		select affiliate_id::text, payout_method, account_name, provider_name,
			account_identifier_last4, provider_recipient_ref, status, updated_at
		from affiliate_payout_profiles where affiliate_id = $1::uuid
	`, affiliateID.String()).Scan(&record.AffiliateID, &record.PayoutMethod,
		&record.AccountName, &record.ProviderName, &last4, &record.ProviderRecipientRef, &record.Status,
		&record.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.AffiliatePayoutProfileRecord{AffiliateID: affiliateID, Status: "unverified"}, nil
	}
	if err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	if last4 != "" {
		record.MaskedIdentifier = "•••• " + last4
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) UpsertAffiliatePayoutProfile(
	ctx context.Context,
	input ports.UpsertAffiliatePayoutProfileInput) (ports.AffiliatePayoutProfileRecord,
	error,
) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	var record ports.AffiliatePayoutProfileRecord
	var last4 string
	err = tx.QueryRow(ctx, `
		insert into affiliate_payout_profiles (
			affiliate_id, payout_method, account_name, provider_name,
			account_identifier_encrypted, account_identifier_last4, provider_recipient_ref,
			status, submitted_at, verified_at
		) values ($1::uuid, $2, $3, $4, $5, $6, $7, 'verified', now(), now())
		on conflict (affiliate_id) do update set
			payout_method = excluded.payout_method,
			account_name = excluded.account_name,
			provider_name = excluded.provider_name,
			account_identifier_encrypted = excluded.account_identifier_encrypted,
			account_identifier_last4 = excluded.account_identifier_last4,
			provider_recipient_ref = excluded.provider_recipient_ref,
			status = 'verified', submitted_at = now(),
			verified_at = now(), updated_at = now()
		returning affiliate_id::text, payout_method, account_name, provider_name,
			account_identifier_last4, provider_recipient_ref, status, updated_at
	`, input.AffiliateID.String(), input.PayoutMethod, input.AccountName,
		input.ProviderName, input.EncryptedIdentifier,
		input.IdentifierLast4, input.ProviderRecipientRef).Scan(&record.AffiliateID,
		&record.PayoutMethod, &record.AccountName, &record.ProviderName,
		&last4, &record.ProviderRecipientRef, &record.Status, &record.UpdatedAt)
	if err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	record.MaskedIdentifier = "•••• " + last4
	if _, err := tx.Exec(ctx, `
		update affiliates
		set payout_mode = 'paystack_transfer', payout_reference = $2,
			updated_at = now()
		where affiliate_id = $1::uuid
	`, input.AffiliateID.String(), input.ProviderRecipientRef); err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) GetAffiliateNotificationPreferences(
	ctx context.Context,
	affiliateID common.ID) (ports.AffiliateNotificationPreferencesRecord,
	error,
) {
	return repo.upsertAffiliateNotificationPreferences(ctx, ports.AffiliateNotificationPreferencesRecord{
		AffiliateID: affiliateID, ConversionEmails: true, ApprovalEmails: true,
		ReversalEmails: true, PayoutEmails: true,
	}, false)
}

func (repo AffiliateAuthRepository) UpsertAffiliateNotificationPreferences(
	ctx context.Context,
	input ports.AffiliateNotificationPreferencesRecord) (ports.AffiliateNotificationPreferencesRecord,
	error,
) {
	return repo.upsertAffiliateNotificationPreferences(ctx, input, true)
}

func (repo AffiliateAuthRepository) upsertAffiliateNotificationPreferences(
	ctx context.Context,
	input ports.AffiliateNotificationPreferencesRecord,
	update bool) (ports.AffiliateNotificationPreferencesRecord,
	error,
) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.AffiliateNotificationPreferencesRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.AffiliateNotificationPreferencesRecord{}, err
	}
	if !update {
		_, err = tx.Exec(ctx, `
			insert into affiliate_notification_preferences (affiliate_id)
			values ($1::uuid) on conflict (affiliate_id) do nothing
		`, input.AffiliateID.String())
	} else {
		_, err = tx.Exec(ctx, `
			insert into affiliate_notification_preferences (
				affiliate_id, conversion_emails, approval_emails,
				reversal_emails, payout_emails
			) values ($1::uuid, $2, $3, $4, $5)
			on conflict (affiliate_id) do update set
				conversion_emails = excluded.conversion_emails,
				approval_emails = excluded.approval_emails,
				reversal_emails = excluded.reversal_emails,
				payout_emails = excluded.payout_emails, updated_at = now()
		`, input.AffiliateID.String(), input.ConversionEmails,
			input.ApprovalEmails, input.ReversalEmails, input.PayoutEmails)
	}
	if err != nil {
		return ports.AffiliateNotificationPreferencesRecord{}, err
	}
	var record ports.AffiliateNotificationPreferencesRecord
	err = tx.QueryRow(ctx, `
		select affiliate_id::text, conversion_emails, approval_emails,
			reversal_emails, payout_emails, updated_at
		from affiliate_notification_preferences where affiliate_id = $1::uuid
	`, input.AffiliateID.String()).Scan(&record.AffiliateID,
		&record.ConversionEmails, &record.ApprovalEmails,
		&record.ReversalEmails, &record.PayoutEmails, &record.UpdatedAt)
	if err != nil {
		return ports.AffiliateNotificationPreferencesRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.AffiliateNotificationPreferencesRecord{}, err
	}
	return record, nil
}

func (repo AffiliateAuthRepository) ExportAffiliateConversions(ctx context.Context, input ports.AffiliateDashboardQuery) ([]ports.AffiliateConversionRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
		select affiliate_conversion_id::text, conversion_type, gross_minor,
			commission_minor, status, created_at
		from affiliate_conversions
		where affiliate_id = $1::uuid and created_at >= $2 and created_at < $3
		order by created_at desc limit 5000
	`, input.AffiliateID.String(), input.From, input.To)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ports.AffiliateConversionRecord{}
	for rows.Next() {
		var record ports.AffiliateConversionRecord
		if err := rows.Scan(&record.ConversionID, &record.ConversionType,
			&record.GrossMinor, &record.CommissionMinor, &record.Status,
			&record.OccurredAt); err != nil {
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
