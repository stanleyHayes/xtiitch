package adminauthhttp

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (handler Handler) growthReport(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	from, to, err := growthReportRange(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	record, err := handler.service.GrowthReport(r.Context(),
		adminauthapp.GrowthReportCommand{
			ActorRole: principal.Role, From: from, To: to,
		})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	writeJSON(w, http.StatusOK, growthReportPayload(record, from, to))
}

func (handler Handler) growthReportCSV(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	from, to, err := growthReportRange(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	record, err := handler.service.GrowthReport(r.Context(),
		adminauthapp.GrowthReportCommand{
			ActorRole: principal.Role, From: from, To: to,
		})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		`attachment; filename="growth-report.csv"`)
	writer := csv.NewWriter(w)
	_ = writer.Write([]string{"metric", "value"})
	for _, item := range growthReportRows(record) {
		_ = writer.Write([]string{item.name, strconv.FormatInt(item.value, 10)})
	}
	writer.Flush()
}

type growthReportRow struct {
	name  string
	value int64
}

func growthReportRows(record ports.AdminGrowthReportRecord) []growthReportRow {
	return []growthReportRow{
		{"clicks", record.ClickCount},
		{"customer_signups", record.CustomerSignupCount},
		{"business_signups", record.BusinessSignupCount},
		{"purchase_conversions", record.PurchaseConversionCount},
		{"paid_plan_conversions", record.PaidPlanConversionCount},
		{"gross_eligible_minor", record.GrossEligibleMinor},
		{"store_discount_minor", record.StoreDiscountMinor},
		{"paid_plan_discount_minor", record.PaidPlanDiscountMinor},
		{"pending_commission_minor", record.PendingCommissionMinor},
		{"approved_commission_minor", record.ApprovedCommissionMinor},
		{"settled_commission_minor", record.SettledCommissionMinor},
		{"reversed_commission_minor", record.ReversedCommissionMinor},
		{"payout_batches", record.PayoutBatchCount},
		{"payout_commission_minor", record.PayoutCommissionMinor},
	}
}

func growthReportRange(r *http.Request) (time.Time, time.Time, error) {
	to := time.Now().UTC()
	from := to.AddDate(0, -1, 0)
	var err error
	if value := strings.TrimSpace(r.URL.Query().Get("from")); value != "" {
		from, err = parseGrowthReportTime(value)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
	}
	if value := strings.TrimSpace(r.URL.Query().Get("to")); value != "" {
		to, err = parseGrowthReportTime(value)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
	}
	return from, to, nil
}

func parseGrowthReportTime(value string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed, nil
	}
	return time.Parse(time.DateOnly, value)
}

func growthReportPayload(record ports.AdminGrowthReportRecord,
	from, to time.Time) map[string]any {
	return map[string]any{
		"from":    from.Format(time.RFC3339),
		"to":      to.Format(time.RFC3339),
		"metrics": growthReportMetrics(record),
	}
}

func growthReportMetrics(record ports.AdminGrowthReportRecord) map[string]int64 {
	return map[string]int64{
		"clicks":                    record.ClickCount,
		"customer_signups":          record.CustomerSignupCount,
		"business_signups":          record.BusinessSignupCount,
		"purchase_conversions":      record.PurchaseConversionCount,
		"paid_plan_conversions":     record.PaidPlanConversionCount,
		"gross_eligible_minor":      record.GrossEligibleMinor,
		"store_discount_minor":      record.StoreDiscountMinor,
		"paid_plan_discount_minor":  record.PaidPlanDiscountMinor,
		"pending_commission_minor":  record.PendingCommissionMinor,
		"approved_commission_minor": record.ApprovedCommissionMinor,
		"settled_commission_minor":  record.SettledCommissionMinor,
		"reversed_commission_minor": record.ReversedCommissionMinor,
		"payout_batches":            record.PayoutBatchCount,
		"payout_commission_minor":   record.PayoutCommissionMinor,
	}
}
