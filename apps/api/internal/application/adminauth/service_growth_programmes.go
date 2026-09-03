package adminauth

import (
	"context"
	"strconv"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type ListAffiliateProgrammesCommand struct {
	ActorRole admindomain.Role
}

type CreateAffiliateProgrammeCommand struct {
	ActorUserID                       common.ID
	ActorRole                         admindomain.Role
	OwnerType                         string
	BusinessID                        *common.ID
	Name                              string
	Description                       string
	Status                            string
	DefaultPurchaseCommissionBPS      int
	DefaultFirstPaidPlanCommissionBPS int
	CookieWindowDays                  int
	HoldDays                          int
	PayoutMode                        string
	MinimumPayoutMinor                int64
	AllowedTargetScope                string
	UserAgent                         string
	IPAddress                         string
}

type UpdateAffiliateProgrammeCommand struct {
	ActorUserID                       common.ID
	ActorRole                         admindomain.Role
	AffiliateProgrammeID              common.ID
	Name                              string
	Description                       string
	Status                            string
	DefaultPurchaseCommissionBPS      int
	DefaultFirstPaidPlanCommissionBPS int
	CookieWindowDays                  int
	HoldDays                          int
	PayoutMode                        string
	MinimumPayoutMinor                int64
	AllowedTargetScope                string
	UserAgent                         string
	IPAddress                         string
	Milestones                        []ports.AdminPartnerMilestoneRecord
}

func (s Service) ListAffiliateProgrammes(
	ctx context.Context,
	cmd ListAffiliateProgrammesCommand,
) ([]ports.AdminAffiliateProgrammeRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}
	return s.businesses.ListAdminAffiliateProgrammes(ctx)
}

func (s Service) CreateAffiliateProgramme(
	ctx context.Context,
	cmd CreateAffiliateProgrammeCommand,
) (ports.AdminAffiliateProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminAffiliateProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	input, err := normalizeCreateAffiliateProgramme(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	record, err := s.businesses.CreateAdminAffiliateProgramme(ctx, input)
	if err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	if err := s.auditAffiliateProgramme(ctx, cmd.ActorUserID, cmd.ActorRole, record, "Created", cmd.IPAddress, cmd.UserAgent); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	return record, nil
}

func (s Service) UpdateAffiliateProgramme(
	ctx context.Context,
	cmd UpdateAffiliateProgrammeCommand,
) (ports.AdminAffiliateProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.AffiliateProgrammeID.IsZero() {
		return ports.AdminAffiliateProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	input, err := normalizeUpdateAffiliateProgramme(cmd)
	if err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	record, err := s.businesses.UpdateAdminAffiliateProgramme(ctx, input)
	if err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	if err := s.auditAffiliateProgramme(ctx, cmd.ActorUserID, cmd.ActorRole, record, "Updated", cmd.IPAddress, cmd.UserAgent); err != nil {
		return ports.AdminAffiliateProgrammeRecord{}, err
	}
	return record, nil
}

func normalizeCreateAffiliateProgramme(
	cmd CreateAffiliateProgrammeCommand,
	programmeID common.ID,
) (ports.CreateAdminAffiliateProgrammeInput, error) {
	ownerType := strings.TrimSpace(cmd.OwnerType)
	if ownerType != "platform" && ownerType != "business" {
		return ports.CreateAdminAffiliateProgrammeInput{}, authdomain.ErrInvalidInput
	}
	if (ownerType == "platform" && cmd.BusinessID != nil) ||
		(ownerType == "business" && (cmd.BusinessID == nil || cmd.BusinessID.IsZero())) {
		return ports.CreateAdminAffiliateProgrammeInput{}, authdomain.ErrInvalidInput
	}
	if !validAffiliateProgrammePolicy(
		cmd.Name, cmd.Status, cmd.DefaultPurchaseCommissionBPS,
		cmd.DefaultFirstPaidPlanCommissionBPS, cmd.CookieWindowDays,
		cmd.HoldDays, cmd.PayoutMode, cmd.MinimumPayoutMinor,
		cmd.AllowedTargetScope,
	) {
		return ports.CreateAdminAffiliateProgrammeInput{}, authdomain.ErrInvalidInput
	}
	return ports.CreateAdminAffiliateProgrammeInput{
		AffiliateProgrammeID: programmeID, OwnerType: ownerType,
		BusinessID: cmd.BusinessID, Name: normalizeProgrammeName(cmd.Name),
		Description: normalizeOperatorNote(cmd.Description), Status: strings.TrimSpace(cmd.Status),
		DefaultPurchaseCommissionBPS:      cmd.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: cmd.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  cmd.CookieWindowDays, HoldDays: cmd.HoldDays,
		PayoutMode: strings.TrimSpace(cmd.PayoutMode), MinimumPayoutMinor: cmd.MinimumPayoutMinor,
		AllowedTargetScope: strings.TrimSpace(cmd.AllowedTargetScope), ActorAdminUser: cmd.ActorUserID,
	}, nil
}

func normalizeUpdateAffiliateProgramme(
	cmd UpdateAffiliateProgrammeCommand,
) (ports.UpdateAdminAffiliateProgrammeInput, error) {
	if !validAffiliateProgrammePolicy(
		cmd.Name, cmd.Status, cmd.DefaultPurchaseCommissionBPS,
		cmd.DefaultFirstPaidPlanCommissionBPS, cmd.CookieWindowDays,
		cmd.HoldDays, cmd.PayoutMode, cmd.MinimumPayoutMinor,
		cmd.AllowedTargetScope,
	) {
		return ports.UpdateAdminAffiliateProgrammeInput{}, authdomain.ErrInvalidInput
	}
	seenThresholds := map[int]bool{}
	for index := range cmd.Milestones {
		milestone := &cmd.Milestones[index]
		milestone.Title = normalizeProgrammeName(milestone.Title)
		milestone.RewardDescription = normalizeOperatorNote(milestone.RewardDescription)
		milestone.Status = strings.TrimSpace(milestone.Status)
		if err := normalizeMilestoneReward(milestone); err != nil {
			return ports.UpdateAdminAffiliateProgrammeInput{}, err
		}
		if milestone.MilestoneID.IsZero() || milestone.Threshold <= 0 || milestone.Title == "" ||
			milestone.RewardDescription == "" || seenThresholds[milestone.Threshold] ||
			!map[string]bool{"active": true, "paused": true, "archived": true}[milestone.Status] {
			return ports.UpdateAdminAffiliateProgrammeInput{}, authdomain.ErrInvalidInput
		}
		seenThresholds[milestone.Threshold] = true
	}
	return ports.UpdateAdminAffiliateProgrammeInput{
		AffiliateProgrammeID: cmd.AffiliateProgrammeID,
		Name:                 normalizeProgrammeName(cmd.Name), Description: normalizeOperatorNote(cmd.Description),
		Status:                            strings.TrimSpace(cmd.Status),
		DefaultPurchaseCommissionBPS:      cmd.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: cmd.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  cmd.CookieWindowDays, HoldDays: cmd.HoldDays,
		PayoutMode: strings.TrimSpace(cmd.PayoutMode), MinimumPayoutMinor: cmd.MinimumPayoutMinor,
		AllowedTargetScope: strings.TrimSpace(cmd.AllowedTargetScope), ActorAdminUser: cmd.ActorUserID,
		Milestones: cmd.Milestones,
	}, nil
}

func validAffiliateProgrammePolicy(
	name string,
	status string,
	purchaseBPS int,
	paidPlanBPS int,
	cookieDays int,
	holdDays int,
	payoutMode string,
	minimumPayout int64,
	targetScope string,
) bool {
	statuses := map[string]bool{"draft": true, "active": true, "paused": true, "archived": true}
	payoutModes := map[string]bool{
		"paystack_split": true, "paystack_transfer": true, "voucher": true, "manual": true,
	}
	targetScopes := map[string]bool{
		"platform": true, "store": true, "collection": true, "design": true, "product": true,
	}
	return normalizeProgrammeName(name) != "" &&
		statuses[strings.TrimSpace(status)] &&
		purchaseBPS >= 0 && purchaseBPS <= 10000 &&
		paidPlanBPS >= 0 && paidPlanBPS <= 10000 &&
		cookieDays >= 1 && cookieDays <= 365 &&
		holdDays >= 0 && holdDays <= 365 &&
		payoutModes[strings.TrimSpace(payoutMode)] &&
		minimumPayout >= 0 &&
		targetScopes[strings.TrimSpace(targetScope)]
}

func normalizeProgrammeName(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

// milestoneRewardTypes are the reward kinds the programme can pay out. The
// brief lists bonuses, money, gifts, merchandise, recognition and access, with
// room for another approved benefit.
var milestoneRewardTypes = map[string]bool{
	"cash": true, "bonus": true, "gift": true, "merchandise": true,
	"recognition": true, "access": true, "other": true,
}

// normalizeMilestoneReward defaults an unset reward type to recognition, which
// is what an unconfigured milestone already was, and holds the rule that a
// monetary reward needs an amount while every other kind has none to carry.
func normalizeMilestoneReward(milestone *ports.AdminPartnerMilestoneRecord) error {
	milestone.RewardType = strings.TrimSpace(milestone.RewardType)
	if milestone.RewardType == "" {
		milestone.RewardType = "recognition"
	}
	if !milestoneRewardTypes[milestone.RewardType] {
		return authdomain.ErrInvalidInput
	}
	monetary := milestone.RewardType == "cash" || milestone.RewardType == "bonus"
	if !monetary {
		milestone.RewardValueMinor = nil
		return nil
	}
	if milestone.RewardValueMinor == nil || *milestone.RewardValueMinor <= 0 {
		return authdomain.ErrInvalidInput
	}
	return nil
}

func (s Service) auditAffiliateProgramme(
	ctx context.Context,
	actorID common.ID,
	role admindomain.Role,
	record ports.AdminAffiliateProgrammeRecord,
	action string,
	ipAddress string,
	userAgent string,
) error {
	return s.recordAudit(ctx, auditInput{
		ActorUserID: actorID, ActorRole: role,
		Action: action + " affiliate programme", TargetType: "affiliate_programme",
		TargetID: record.AffiliateProgrammeID.String(), TargetLabel: record.Name,
		Summary:  action + " affiliate programme policy. " + affiliateProgrammePolicySummary(record),
		Severity: "info", IPAddress: ipAddress, UserAgent: userAgent,
		Metadata: map[string]string{
			"owner_type":               record.OwnerType,
			"status":                   record.Status,
			"purchase_commission_bps":  strconv.Itoa(record.DefaultPurchaseCommissionBPS),
			"paid_plan_commission_bps": strconv.Itoa(record.DefaultFirstPaidPlanCommissionBPS),
			"maturity_days":            strconv.Itoa(record.HoldDays),
			// Item 12: configuration changes are auditable in both directions.
			// A create has no prior state, so these stay empty there.
			"previous_status":                   record.PreviousStatus,
			"previous_purchase_commission_bps":  previousBPSString(record.PreviousStatus, record.PreviousDefaultPurchaseCommissionBPS),
			"previous_paid_plan_commission_bps": previousBPSString(record.PreviousStatus, record.PreviousDefaultFirstPaidPlanCommissionBPS),
			"previous_maturity_days":            previousBPSString(record.PreviousStatus, record.PreviousHoldDays),
		},
	})
}

// affiliateProgrammePolicySummary states the commission terms now in force so
// the audit row reads without opening the metadata.
func affiliateProgrammePolicySummary(record ports.AdminAffiliateProgrammeRecord) string {
	summary := "Recurring commission " +
		strconv.FormatFloat(float64(record.DefaultFirstPaidPlanCommissionBPS)/100, 'f', 2, 64) +
		"%, maturity " + strconv.Itoa(record.HoldDays) + " days."
	if record.PreviousStatus == "" {
		return summary
	}
	return summary + " Previously " +
		strconv.FormatFloat(float64(record.PreviousDefaultFirstPaidPlanCommissionBPS)/100, 'f', 2, 64) +
		"%, maturity " + strconv.Itoa(record.PreviousHoldDays) + " days."
}

// previousBPSString renders a prior numeric setting, or an empty string when
// there was no prior state (a newly created programme).
func previousBPSString(previousStatus string, value int) string {
	if previousStatus == "" {
		return ""
	}
	return strconv.Itoa(value)
}
