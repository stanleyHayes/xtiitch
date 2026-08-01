package affiliateauth

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/csv"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var campaignSlugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

func (s Service) CampaignLinks(ctx context.Context, affiliateID common.ID) ([]ports.AffiliateCampaignLinkRecord, error) {
	if affiliateID.IsZero() {
		return nil, ErrInvalidInput
	}
	return s.portal.ListAffiliateCampaignLinks(ctx, affiliateID)
}

func (s Service) CreateCampaignLink(ctx context.Context, accountID, affiliateID common.ID, name, slug, destination string) (ports.AffiliateCampaignLinkRecord, error) {
	name = strings.TrimSpace(name)
	slug = strings.ToLower(strings.TrimSpace(slug))
	destination = strings.TrimSpace(destination)
	parsed, err := url.Parse(destination)
	host := ""
	if err == nil {
		host = strings.ToLower(parsed.Hostname())
	}
	if affiliateID.IsZero() || len(name) == 0 || len(name) > 100 ||
		!campaignSlugPattern.MatchString(slug) || err != nil ||
		parsed.Scheme != "https" || parsed.Host == "" ||
		(host != "xtiitch.com" && !strings.HasSuffix(host, ".xtiitch.com")) {
		return ports.AffiliateCampaignLinkRecord{}, ErrInvalidInput
	}
	query := parsed.Query()
	account, err := s.Me(ctx, accountID)
	if err != nil {
		return ports.AffiliateCampaignLinkRecord{}, err
	}
	query.Set("affiliate_code", account.Code)
	query.Set("utm_source", "affiliate")
	query.Set("utm_medium", "referral")
	query.Set("utm_campaign", slug)
	parsed.RawQuery = query.Encode()
	return s.portal.CreateAffiliateCampaignLink(ctx, ports.CreateAffiliateCampaignLinkInput{
		CampaignLinkID: s.ids.NewID(), AffiliateID: affiliateID,
		Name: name, Slug: slug, DestinationURL: parsed.String(),
		UTMCampaign: slug,
	})
}

func (s Service) PayoutProfile(ctx context.Context, affiliateID common.ID) (ports.AffiliatePayoutProfileRecord, error) {
	if affiliateID.IsZero() {
		return ports.AffiliatePayoutProfileRecord{}, ErrInvalidInput
	}
	return s.portal.GetAffiliatePayoutProfile(ctx, affiliateID)
}

func (s Service) UpdatePayoutProfile(
	ctx context.Context,
	affiliateID common.ID,
	method,
	accountName,
	providerName,
	identifier string) (ports.AffiliatePayoutProfileRecord,
	error,
) {
	method = strings.TrimSpace(method)
	accountName = strings.TrimSpace(accountName)
	providerName = strings.TrimSpace(providerName)
	identifier = strings.ReplaceAll(strings.TrimSpace(identifier), " ", "")
	if affiliateID.IsZero() || s.sensitiveCipher == nil ||
		(method != "mobile_money" && method != "bank" && method != "manual") ||
		accountName == "" || providerName == "" || len(identifier) < 4 ||
		len(identifier) > 64 {
		return ports.AffiliatePayoutProfileRecord{}, ErrInvalidInput
	}
	encrypted, err := s.sensitiveCipher.EncryptSecret(identifier)
	if err != nil {
		return ports.AffiliatePayoutProfileRecord{}, err
	}
	return s.portal.UpsertAffiliatePayoutProfile(ctx, ports.UpsertAffiliatePayoutProfileInput{
		AffiliateID: affiliateID, PayoutMethod: method,
		AccountName: accountName, ProviderName: providerName,
		EncryptedIdentifier: base64.RawStdEncoding.EncodeToString(encrypted),
		IdentifierLast4:     identifier[len(identifier)-4:],
	})
}

func (s Service) NotificationPreferences(ctx context.Context, affiliateID common.ID) (ports.AffiliateNotificationPreferencesRecord, error) {
	if affiliateID.IsZero() {
		return ports.AffiliateNotificationPreferencesRecord{}, ErrInvalidInput
	}
	return s.portal.GetAffiliateNotificationPreferences(ctx, affiliateID)
}

func (s Service) UpdateNotificationPreferences(
	ctx context.Context,
	input ports.AffiliateNotificationPreferencesRecord) (ports.AffiliateNotificationPreferencesRecord,
	error,
) {
	if input.AffiliateID.IsZero() {
		return ports.AffiliateNotificationPreferencesRecord{}, ErrInvalidInput
	}
	return s.portal.UpsertAffiliateNotificationPreferences(ctx, input)
}

func (s Service) ConversionCSV(ctx context.Context, affiliateID common.ID, from, to time.Time) ([]byte, error) {
	if affiliateID.IsZero() || !from.Before(to) || to.Sub(from) > 366*24*time.Hour {
		return nil, ErrInvalidInput
	}
	records, err := s.portal.ExportAffiliateConversions(ctx, ports.AffiliateDashboardQuery{
		AffiliateID: affiliateID, From: from, To: to,
	})
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	writer := csv.NewWriter(&output)
	_ = writer.Write([]string{"date", "type", "gross_minor", "commission_minor", "status"})
	for _, record := range records {
		_ = writer.Write([]string{record.OccurredAt.UTC().Format(time.RFC3339),
			record.ConversionType, strconv.FormatInt(record.GrossMinor, 10),
			strconv.FormatInt(record.CommissionMinor, 10), record.Status})
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}
