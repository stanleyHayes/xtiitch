package paymentshttp

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// Payout-history paging bounds: a sane default page and a hard cap, matching
// the admin CRM's clamps.
const (
	defaultPayoutPageLimit = 50
	maxPayoutPageLimit     = 200
)

// moneyPeriodFromRequest resolves the Money Desk time filter (§3) from the
// request: the named periods are derived from the clock, while "custom" reads
// the from/to date query params. Kept separate from parseMoneyPeriod so the
// named-period logic stays a pure, clock-only function.
func moneyPeriodFromRequest(r *http.Request, now func() time.Time) ports.MoneyPeriod {
	query := r.URL.Query()
	if strings.TrimSpace(strings.ToLower(query.Get("period"))) == "custom" {
		return customMoneyPeriod(query.Get("from"), query.Get("to"))
	}
	return parseMoneyPeriod(query.Get("period"), now)
}

// customMoneyPeriod builds a half-open [from, to) range from two YYYY-MM-DD
// dates (§3 custom range). The end date is inclusive to the owner, so it is
// advanced one day to the next midnight. A missing or malformed bound is simply
// left open, so a one-sided custom range still works.
func customMoneyPeriod(fromValue, toValue string) ports.MoneyPeriod {
	const dateLayout = "2006-01-02"
	var period ports.MoneyPeriod
	if from, err := time.Parse(dateLayout, strings.TrimSpace(fromValue)); err == nil {
		start := from.UTC()
		period.From = &start
	}
	if to, err := time.Parse(dateLayout, strings.TrimSpace(toValue)); err == nil {
		end := to.AddDate(0, 0, 1).UTC()
		period.To = &end
	}
	return period
}

func parseMoneyPeriod(value string, now func() time.Time) ports.MoneyPeriod {
	current := now().UTC()
	today := time.Date(current.Year(), current.Month(), current.Day(), 0, 0, 0, 0, time.UTC)
	thisMonth := time.Date(current.Year(), current.Month(), 1, 0, 0, 0, 0, time.UTC)
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "today":
		to := today.AddDate(0, 0, 1)
		return ports.MoneyPeriod{From: &today, To: &to}
	case "yesterday":
		from := today.AddDate(0, 0, -1)
		return ports.MoneyPeriod{From: &from, To: &today}
	case "last_7_days", "last7", "7_days":
		from := today.AddDate(0, 0, -6)
		to := today.AddDate(0, 0, 1)
		return ports.MoneyPeriod{From: &from, To: &to}
	case "this_month", "month":
		to := thisMonth.AddDate(0, 1, 0)
		return ports.MoneyPeriod{From: &thisMonth, To: &to}
	case "last_month":
		from := thisMonth.AddDate(0, -1, 0)
		return ports.MoneyPeriod{From: &from, To: &thisMonth}
	default:
		return ports.MoneyPeriod{}
	}
}

func parsePagingLimit(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 || parsed > maxPayoutPageLimit {
		return defaultPayoutPageLimit
	}
	return parsed
}

func parsePagingOffset(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}
