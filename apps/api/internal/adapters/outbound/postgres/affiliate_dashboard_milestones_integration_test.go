package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestAffiliateDashboardReturnsOwnMilestoneRewardStatus(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	seedAdminAffiliateConversionFixture(t, pool)
	defer cleanupAdminAffiliateConversionFixture(t, pool)
	defer inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from partner_milestone_achievements where affiliate_id=$1`, itAdminAffAffiliate)
	})

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `
			insert into partner_milestone_achievements(
				partner_milestone_achievement_id, affiliate_id,
				partner_milestone_id, reward_status
			)
			select $1, $2, partner_milestone_id, 'processing'
			from partner_milestones where threshold=10
		`, "93939393-1111-4111-8111-111111111111", itAdminAffAffiliate)
	})

	now := time.Now()
	record, err := NewAffiliateAuthRepository(pool).GetAffiliateDashboard(
		context.Background(),
		ports.AffiliateDashboardQuery{
			AffiliateID: common.ID(itAdminAffAffiliate),
			From:        now.Add(-30 * 24 * time.Hour), To: now.Add(time.Hour),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(record.MilestoneAchievements) != 1 {
		t.Fatalf("expected one milestone achievement, got %+v", record.MilestoneAchievements)
	}
	achievement := record.MilestoneAchievements[0]
	if achievement.Threshold != 10 || achievement.RewardStatus != "processing" || achievement.RewardDescription == "" {
		t.Fatalf("unexpected milestone achievement: %+v", achievement)
	}
}
