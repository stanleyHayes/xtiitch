package adminauthhttp

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (handler Handler) exportDatasetCSV(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	dataset := strings.TrimSpace(chi.URLParam(r, "dataset"))
	rows, err := handler.exportDatasetRows(r.Context(), principal, dataset)
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	if len(rows) == 0 {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}

	writeCSV(w, "xtiitch-admin-"+safeExportName(dataset)+".csv", rows)
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (handler Handler) exportDatasetRows(
	ctx context.Context,
	principal Principal,
	dataset string,
) ([][]string, error) {
	switch dataset {
	case "report-posture":
		metrics, err := handler.service.GetPlatformMetrics(ctx, adminauthapp.GetPlatformMetricsCommand{
			ActorRole: principal.Role,
		})
		if err != nil {
			return nil, err
		}
		settings, err := handler.service.GetPlatformSettings(ctx)
		if err != nil {
			return nil, err
		}
		return [][]string{
			{"Metric", "Value", "Detail"},
			{"GMV this month", moneyCSV(metrics.GMVMonthMinor), "Succeeded platform payments"},
			{"Commission", moneyCSV(metrics.PlatformRevenueMonthMinor), "Platform revenue month to date"},
			{"Active businesses", fmt.Sprint(metrics.ActiveBusinesses), fmt.Sprintf("%d total tenants", metrics.TotalBusinesses)},
			{"Pending KYC", fmt.Sprint(metrics.PendingVerifications), "Business verification backlog"},
			{"Suspended businesses", fmt.Sprint(metrics.SuspendedBusinesses), "Operational holds"},
			{
				"Payment health",
				fmt.Sprintf("%.2f%%", float64(metrics.PaymentHealthBPS)/100),
				fmt.Sprintf("%d failed of %d payments in 30 days", metrics.FailedPayments30d, metrics.TotalPayments30d),
			},
			{
				"Platform policy",
				boolCSV(!settings.MaintenanceMode, "Live", "Maintenance"),
				fmt.Sprintf("%dh verification SLA", settings.VerificationSLAHours),
			},
			{"Payout review threshold", moneyCSV(int64(settings.PayoutReviewThresholdPesewas)), "Admin settlement review threshold"},
		}, nil
	case "launch-readiness":
		readiness, err := handler.service.GetLaunchReadiness(ctx, adminauthapp.GetLaunchReadinessCommand{
			ActorRole: principal.Role,
		})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Category", "Gate", "Status", "Summary", "Detail", "Action", "Target", "Updated"}}
		for _, check := range readiness.Checks {
			rows = append(rows, []string{
				check.Category,
				check.Label,
				check.Status,
				check.Summary,
				check.Detail,
				check.Action,
				check.TargetLabel,
				timeCSV(readiness.UpdatedAt),
			})
		}
		return rows, nil
	case "businesses":
		records, err := handler.service.ListBusinesses(ctx, adminauthapp.ListBusinessesCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{
			{"Business", "Handle", "Owner", "Status", "Operational", "Plan", "Orders", "GMV", "Commission", "Risk", "Subaccount", "Last active"},
		}
		for _, record := range records {
			rows = append(rows, []string{
				record.Name,
				record.Handle,
				fallbackText(record.OwnerEmail, record.OwnerName),
				businessListStatus(record),
				string(record.OperationalStatus),
				fallbackText(record.PlanName, record.PlanCode),
				fmt.Sprint(record.OrdersCount),
				moneyCSV(record.GMVMinor),
				moneyCSV(record.CommissionMinor),
				businessRiskLevel(record),
				record.SettlementSubaccount,
				timeCSV(record.LastActiveAt),
			})
		}
		return rows, nil
	case "customers":
		records, err := handler.service.ListCustomers(ctx, adminauthapp.ListCustomersCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{
			{"Customer", "Email", "Phone", "Businesses", "Orders", "Custom orders", "GMV", "Last business", "Last active", "Created"},
		}
		for _, record := range records {
			rows = append(rows, []string{
				fallbackText(record.DisplayName, record.CustomerID.String()),
				record.Email,
				record.Phone,
				fmt.Sprint(record.TenantCount),
				fmt.Sprint(record.OrderCount),
				fmt.Sprint(record.CustomOrderCount),
				moneyCSV(record.GMVMinor),
				fallbackText(record.LastBusinessName, record.LastBusinessHandle),
				timeCSV(record.LastActiveAt),
				timeCSV(record.CreatedAt),
			})
		}
		return rows, nil
	case "verification":
		records, err := handler.service.ListBusinessVerifications(ctx, adminauthapp.ListBusinessVerificationsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Business", "Handle", "Owner", "Email", "Status", "Risk", "Plan", "Documents", "Submitted", "Updated", "Notes"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.BusinessName,
				record.Handle,
				record.OwnerName,
				record.OwnerEmail,
				string(record.VerificationStatus),
				verificationRiskLevel(record),
				fallbackText(record.PlanName, record.PlanCode),
				strings.Join(verificationDocuments(record), "; "),
				timeCSV(record.SubmittedAt),
				timeCSV(record.UpdatedAt),
				verificationNotes(record),
			})
		}
		return rows, nil
	case "money":
		record, err := handler.service.GetMoneyRails(ctx, adminauthapp.GetMoneyRailsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Kind", "Business", "Reference", "Status", "Amount", "Attempts", "Received/Updated", "Note"}}
		for _, event := range record.WebhookEvents {
			rows = append(rows, []string{
				"Webhook",
				event.BusinessName,
				event.ProviderReference,
				event.Status,
				moneyCSV(event.AmountMinor),
				fmt.Sprint(event.Attempts),
				timeCSV(event.ReceivedAt),
				event.Note,
			})
		}
		for _, review := range record.PayoutReviews {
			status := review.Status
			if review.HoldActive {
				status = "held"
			}
			rows = append(rows, []string{
				"Settlement",
				review.BusinessName,
				review.SubaccountRef,
				status,
				moneyCSV(review.SettlementMinor),
				"",
				optionalTimeCSV(review.HoldUpdatedAt),
				fallbackText(review.HoldReason, review.NextAction),
			})
		}
		return rows, nil
	case "risk":
		records, err := handler.service.ListRiskReviews(ctx, adminauthapp.ListRiskReviewsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Title", "Business", "Level", "Status", "Owner", "Updated", "Reason"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.Title,
				record.BusinessName,
				record.Level,
				record.Status,
				record.Owner,
				timeCSV(record.UpdatedAt),
				record.Reason,
			})
		}
		return rows, nil
	case "support":
		records, err := handler.service.ListSupportTickets(ctx, adminauthapp.ListSupportTicketsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Subject", "Business", "Category", "Priority", "Status", "Assigned", "Created", "Updated", "Summary"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.Subject,
				record.BusinessName,
				record.Category,
				record.Priority,
				record.Status,
				fallbackText(record.AssignedAdminName, record.AssignedAdminEmail),
				timeCSV(record.CreatedAt),
				timeCSV(record.UpdatedAt),
				record.Summary,
			})
		}
		return rows, nil
	case "audit":
		records, err := handler.service.ListAuditEvents(ctx, adminauthapp.ListAuditEventsCommand{
			ActorRole: principal.Role,
			Limit:     500,
		})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Action", "Actor", "Role", "Severity", "Target", "Created", "Detail"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.Action,
				record.ActorEmail,
				string(record.ActorRole),
				string(record.Severity),
				fallbackText(record.TargetLabel, record.TargetID),
				timeCSV(record.CreatedAt),
				record.Summary,
			})
		}
		return rows, nil
	case "users":
		records, err := handler.service.ListUsers(ctx, adminauthapp.ListUsersCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Name", "Email", "Role", "Active", "Created", "Updated"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.DisplayName,
				record.Email,
				string(record.Role),
				boolCSV(record.IsActive, "Active", "Inactive"),
				timeCSV(record.CreatedAt),
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "roles":
		records, err := handler.service.ListRolePermissions(ctx)
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Role", "Label", "Permission count", "Permissions"}}
		for _, record := range records {
			permissions := make([]string, 0, len(record.Permissions))
			for _, permission := range record.Permissions {
				permissions = append(permissions, permissionLabel(permission))
			}
			rows = append(rows, []string{
				string(record.Role),
				roleLabel(record.Role),
				fmt.Sprint(len(record.Permissions)),
				strings.Join(permissions, "; "),
			})
		}
		return rows, nil
	case "settings":
		profile, err := handler.service.GetProfileSettings(ctx, principal.AdminUserID)
		if err != nil {
			return nil, err
		}
		settings, err := handler.service.GetPlatformSettings(ctx)
		if err != nil {
			return nil, err
		}
		preferences := profile.Preferences
		return [][]string{
			{"Area", "Setting", "Value", "Detail"},
			{"Operator profile", "Display name", profile.User.DisplayName, profile.User.Email},
			{"Operator profile", "Role", string(profile.User.Role), boolCSV(profile.User.IsActive, "Active", "Inactive")},
			{"Notification preferences", "Email alerts", boolCSV(preferences.NotifyEmail, "On", "Off"), "Primary operator delivery route"},
			{
				"Notification preferences", "SMS alerts",
				boolCSV(preferences.NotifySMS, "On", "Off"),
				fallbackText(preferences.PhoneNumber, "No phone number"),
			},
			{"Notification preferences", "Daily digest", preferences.DailyDigestTime, preferences.Timezone},
			{
				"Notification preferences", "Verification alerts",
				boolCSV(preferences.AlertVerifications, "Watched", "Muted"),
				"Business verification queue",
			},
			{
				"Notification preferences", "Money rail alerts",
				boolCSV(preferences.AlertMoneyRails, "Watched", "Muted"),
				"Payment, payout, and webhook queue",
			},
			{
				"Notification preferences", "Subscription alerts",
				boolCSV(preferences.AlertSubscriptions, "Watched", "Muted"),
				"Subscription billing and plan usage",
			},
			{
				"Notification preferences", "Promotion alerts",
				boolCSV(preferences.AlertPromotions, "Watched", "Muted"),
				"Promotion redemption activity",
			},
			{"Notification preferences", "Risk alerts", boolCSV(preferences.AlertRisk, "Watched", "Muted"), "Risk review queue"},
			{"Notification preferences", "Support alerts", boolCSV(preferences.AlertSupport, "Watched", "Muted"), "Support queue"},
			{"Platform policy", "Platform name", settings.PlatformName, settings.SupportEmail},
			{"Platform policy", "Maintenance mode", boolCSV(settings.MaintenanceMode, "On", "Off"), "Global operator-controlled maintenance flag"},
			{"Platform policy", "Verification SLA", fmt.Sprintf("%dh", settings.VerificationSLAHours), "Target KYC review window"},
			{"Platform policy", "Payout review threshold", moneyCSV(int64(settings.PayoutReviewThresholdPesewas)), "Settlement review threshold"},
		}, nil
	case "subscriptions":
		records, err := handler.service.ListSubscriptions(ctx, adminauthapp.ListSubscriptionsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{
			"Business",
			"Owner",
			"Phone",
			"Email",
			"WhatsApp",
			"Plan",
			"Billing cadence",
			"Status",
			"Signup date",
			"Renewal date",
			"Store link",
			"Discount code",
			"Institution",
			"Total sales",
			"Last active",
			"Monthly fee",
			"Last invoice",
			"Last payment",
			"Next billing",
		}}
		for _, record := range records {
			rows = append(rows, []string{
				record.BusinessName,
				record.OwnerName,
				record.OwnerPhone,
				record.OwnerEmail,
				record.OwnerWhatsApp,
				record.PlanName,
				record.BillingMode,
				record.Status,
				timeCSV(record.SignupAt),
				optionalTimeCSV(record.RenewalAt),
				record.StoreLink,
				record.DiscountCode,
				record.DiscountInstitution,
				moneyCSV(record.GMVMinor),
				timeCSV(record.LastActiveAt),
				moneyCSV(record.MonthlyFeeMinor),
				record.LastInvoiceRef,
				optionalTimeCSV(record.LastPaymentAt),
				optionalTimeCSV(record.NextBillingAt),
			})
		}
		return rows, nil
	case "plans":
		records, err := handler.service.ListPlans(ctx, adminauthapp.ListPlansCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{
			{
				"Name", "Code", "Active", "Monthly fee", "Yearly fee", "Commission",
				"Design limit", "Businesses", "Active subscriptions", "Estimated MRR", "Created", "Updated",
			},
		}
		for _, record := range records {
			designLimit := "Unlimited"
			if record.DesignLimit != nil {
				designLimit = fmt.Sprint(*record.DesignLimit)
			}
			rows = append(rows, []string{
				record.Name,
				record.Code,
				boolCSV(record.IsActive, "Active", "Archived"),
				moneyCSV(record.MonthlyFeeMinor),
				moneyCSV(record.YearlyFeeMinor),
				fmt.Sprintf("%.2f%%", float64(record.CommissionBPS)/100),
				designLimit,
				fmt.Sprint(record.BusinessCount),
				fmt.Sprint(record.ActiveSubscriptionCount),
				moneyCSV(record.EstimatedMRRMinor),
				timeCSV(record.CreatedAt),
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "promotions":
		records, err := handler.service.ListPromotions(ctx, adminauthapp.ListPromotionsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{{"Title", "Code", "Business", "Status", "Type", "Value", "Funding", "Scope", "Redemptions", "Discount redeemed"}}
		for _, record := range records {
			rows = append(rows, []string{
				record.Title,
				record.Code,
				fallbackText(record.BusinessName, "Platform-wide"),
				record.Status,
				record.DiscountType,
				fmt.Sprint(record.DiscountValue),
				record.FundingSource,
				record.Scope,
				fmt.Sprint(record.RedemptionCount),
				moneyCSV(record.DiscountRedeemedMinor),
			})
		}
		return rows, nil
	case "ad-campaigns":
		records, err := handler.service.ListAdCampaigns(ctx, adminauthapp.ListAdCampaignsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{
			{
				"Campaign", "Business", "Handle", "Placement", "Target", "Status", "Pricing",
				"Budget", "Spend", "Daily cap", "Starts", "Ends", "Impressions", "Clicks", "CTR",
				"Review note", "Updated",
			},
		}
		for _, record := range records {
			dailyCap := ""
			if record.DailyCapMinor != nil {
				dailyCap = moneyCSV(*record.DailyCapMinor)
			}
			rows = append(rows, []string{
				record.Headline,
				record.BusinessName,
				record.BusinessHandle,
				record.PlacementType,
				fallbackText(record.TargetLabel, record.TargetRefID),
				record.Status,
				record.PricingModel,
				moneyCSV(record.BudgetMinor),
				moneyCSV(record.SpendMinor),
				dailyCap,
				timeCSV(record.StartsAt),
				timeCSV(record.EndsAt),
				fmt.Sprint(record.ImpressionCount),
				fmt.Sprint(record.ClickCount),
				fmt.Sprintf("%.2f%%", float64(record.ClickRateBPS)/100),
				record.ReviewNote,
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "affiliates":
		records, err := handler.service.ListAffiliates(ctx, adminauthapp.ListAffiliatesCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{
			{
				"Affiliate", "Code", "Entity", "Contact", "Email", "Phone", "Website",
				"Commission", "Cookie window", "Payout mode", "Payout reference", "Status", "Notes", "Updated",
			},
		}
		for _, record := range records {
			commission := moneyCSV(record.CommissionRate)
			if record.CommissionModel == "percentage" {
				commission = fmt.Sprintf("%.2f%%", float64(record.CommissionRate)/100)
			}
			rows = append(rows, []string{
				record.DisplayName,
				record.Code,
				record.EntityType,
				record.ContactName,
				record.Email,
				record.Phone,
				record.WebsiteURL,
				commission,
				fmt.Sprintf("%d days", record.CookieWindowDays),
				record.PayoutMode,
				record.PayoutReference,
				record.Status,
				record.Notes,
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "referral-programmes":
		records, err := handler.service.ListReferralProgrammes(ctx, adminauthapp.ListReferralProgrammesCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{
			{
				"Programme", "Code prefix", "Audience", "Referrer reward", "New customer reward",
				"Reward", "Reward cap", "Minimum order", "Hold days", "Status", "Starts", "Ends", "Notes", "Updated",
			},
		}
		for _, record := range records {
			reward := moneyCSV(record.RewardValue)
			if record.RewardType == "percentage" {
				reward = fmt.Sprintf("%.2f%%", float64(record.RewardValue)/100)
			}
			rewardCap := ""
			if record.MaxRewardMinor != nil {
				rewardCap = moneyCSV(*record.MaxRewardMinor)
			}
			rows = append(rows, []string{
				record.Title,
				record.CodePrefix,
				record.Audience,
				record.ReferrerRewardKind,
				record.RefereeRewardKind,
				reward,
				rewardCap,
				moneyCSV(record.QualifyingOrderMinMinor),
				fmt.Sprintf("%d days", record.RewardHoldDays),
				record.Status,
				optionalTimeCSV(record.StartsAt),
				optionalTimeCSV(record.EndsAt),
				record.Notes,
				timeCSV(record.UpdatedAt),
			})
		}
		return rows, nil
	case "promotion-redemptions":
		records, err := handler.service.ListPromotions(ctx, adminauthapp.ListPromotionsCommand{ActorRole: principal.Role})
		if err != nil {
			return nil, err
		}
		rows := [][]string{
			{
				"Promotion", "Code", "Business", "Business ID", "Customer", "Customer ID",
				"Order ID", "Status", "Discount", "Redeemed at", "Created at", "Updated at",
			},
		}
		for _, record := range records {
			for _, redemption := range record.RecentRedemptions {
				customerID := ""
				if redemption.CustomerID != nil {
					customerID = redemption.CustomerID.String()
				}
				orderID := ""
				if redemption.OrderID != nil {
					orderID = redemption.OrderID.String()
				}
				rows = append(rows, []string{
					record.Title,
					record.Code,
					fallbackText(record.BusinessName, "Platform-wide"),
					redemption.BusinessID.String(),
					fallbackText(redemption.CustomerName, "Unknown customer"),
					customerID,
					orderID,
					redemption.Status,
					moneyCSV(redemption.DiscountMinor),
					optionalTimeCSV(redemption.RedeemedAt),
					timeCSV(redemption.CreatedAt),
					timeCSV(redemption.UpdatedAt),
				})
			}
		}
		return rows, nil
	default:
		return nil, ports.ErrNotFound
	}
}
