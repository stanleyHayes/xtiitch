package adminauth

import (
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

// Item 6: rewards are configurable, so the reward type is validated and a
// monetary reward without an amount is not a configured reward at all.
func TestMilestoneRewardConfigurationRules(t *testing.T) {
	t.Parallel()

	amount := int64(50000)
	zero := int64(0)

	t.Run("an unset type keeps the recognition a milestone already was", func(t *testing.T) {
		milestone := ports.AdminPartnerMilestoneRecord{RewardType: "  "}
		if err := normalizeMilestoneReward(&milestone); err != nil {
			t.Fatalf("normalize: %v", err)
		}
		if milestone.RewardType != "recognition" || milestone.RewardValueMinor != nil {
			t.Fatalf("unexpected default reward, got %+v", milestone)
		}
	})

	t.Run("a monetary reward carries its amount", func(t *testing.T) {
		milestone := ports.AdminPartnerMilestoneRecord{RewardType: "cash", RewardValueMinor: &amount}
		if err := normalizeMilestoneReward(&milestone); err != nil {
			t.Fatalf("normalize: %v", err)
		}
		if milestone.RewardValueMinor == nil || *milestone.RewardValueMinor != 50000 {
			t.Fatalf("expected the amount to survive, got %+v", milestone)
		}
	})

	t.Run("a non-monetary reward carries no amount", func(t *testing.T) {
		milestone := ports.AdminPartnerMilestoneRecord{RewardType: "merchandise", RewardValueMinor: &amount}
		if err := normalizeMilestoneReward(&milestone); err != nil {
			t.Fatalf("normalize: %v", err)
		}
		if milestone.RewardValueMinor != nil {
			t.Fatalf("expected merchandise to drop the amount, got %+v", milestone)
		}
	})

	for name, milestone := range map[string]ports.AdminPartnerMilestoneRecord{
		"an unknown reward type": {RewardType: "crypto"},
		"money with no amount":   {RewardType: "cash"},
		"a bonus worth nothing":  {RewardType: "bonus", RewardValueMinor: &zero},
	} {
		t.Run(name+" is refused", func(t *testing.T) {
			candidate := milestone
			if err := normalizeMilestoneReward(&candidate); !errors.Is(err, authdomain.ErrInvalidInput) {
				t.Fatalf("expected invalid input, got %v", err)
			}
		})
	}
}
