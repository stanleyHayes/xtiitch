package affiliateauth

import (
	"context"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeSensitiveCipher struct {
	plaintext string
}

func (cipher *fakeSensitiveCipher) EncryptSecret(value string) ([]byte, error) {
	cipher.plaintext = value
	return []byte("sealed:" + value), nil
}

func TestCreateCampaignLinkAddsOwnedAffiliateAttribution(t *testing.T) {
	t.Parallel()
	repo := &fakeAffiliateAuthRepository{account: ports.AffiliateAccountRecord{
		AccountID: "account-1", AffiliateID: "affiliate-1", Code: "AMA20",
	}}
	service := testService(repo)

	_, err := service.CreateCampaignLink(context.Background(),
		repo.account.AccountID, repo.account.AffiliateID, "Launch",
		"launch-week", "https://xtiitch.com/register?source=profile")
	if err != nil {
		t.Fatalf("create campaign link: %v", err)
	}
	url := repo.campaignInput.DestinationURL
	if !strings.Contains(url, "affiliate_code="+repo.account.Code) ||
		!strings.Contains(url, "utm_campaign=launch-week") {
		t.Fatalf("campaign URL omitted safe attribution: %q", url)
	}
}

func TestUpdatePayoutProfileEncryptsAndStoresOnlyLastFour(t *testing.T) {
	t.Parallel()
	repo := &fakeAffiliateAuthRepository{}
	cipher := &fakeSensitiveCipher{}
	service := testService(repo)
	service.sensitiveCipher = cipher

	_, err := service.UpdatePayoutProfile(context.Background(),
		common.ID("affiliate-1"), "mobile_money", "Ama Mensah", "MTN",
		"024 123 4567")
	if err != nil {
		t.Fatalf("update payout profile: %v", err)
	}
	if cipher.plaintext != "0241234567" ||
		repo.payoutInput.IdentifierLast4 != "4567" ||
		repo.payoutInput.ProviderRecipientRef != "RCP_affiliate" ||
		strings.Contains(repo.payoutInput.EncryptedIdentifier, "0241234567") {
		t.Fatalf("sensitive payout value was not safely transformed: %+v",
			repo.payoutInput)
	}
}

func TestAffiliatePayoutProviderDetailsRejectsUnsupportedBank(t *testing.T) {
	t.Parallel()

	if _, _, ok := affiliatePayoutProviderDetails("bank", "Bank of Ghana"); ok {
		t.Fatal("Bank of Ghana must not be offered as a Paystack transfer destination")
	}
	if recipientType, code, ok := affiliatePayoutProviderDetails("bank", "GCB Bank Limited"); !ok || recipientType != "ghipss" || code != "040100" {
		t.Fatalf("expected GCB GHIPSS mapping, got type=%q code=%q ok=%v", recipientType, code, ok)
	}
}

func TestUpdatePayoutProfileRejectsInvalidMobileMoneyNumber(t *testing.T) {
	t.Parallel()
	service := testService(&fakeAffiliateAuthRepository{})
	service.sensitiveCipher = &fakeSensitiveCipher{}

	_, err := service.UpdatePayoutProfile(context.Background(), common.ID("affiliate-1"),
		"mobile_money", "Ama Mensah", "MTN", "1234")
	if err != ErrInvalidInput {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
