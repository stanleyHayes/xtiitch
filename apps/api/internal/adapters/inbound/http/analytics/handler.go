// Package analyticshttp exposes the §14 analytics endpoints: tenant-scoped,
// owner-auth, entitlement-gated read models under /v1/analytics/*.
package analyticshttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	analyticsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/analytics"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

type Service interface {
	Summary(ctx context.Context, cmd analyticsapp.Command) (analyticsapp.SummaryResult, error)
	SalesTrend(ctx context.Context, cmd analyticsapp.Command) (analyticsapp.SalesTrendResult, error)
	OrdersTrend(ctx context.Context, cmd analyticsapp.Command) (analyticsapp.OrdersTrendResult, error)
	TopDesigns(ctx context.Context, cmd analyticsapp.Command, limit int) (analyticsapp.TopDesignsResult, error)
	Customers(ctx context.Context, cmd analyticsapp.Command, limit int) (analyticsapp.CustomersResult, error)
	OutstandingBalances(ctx context.Context, cmd analyticsapp.Command) ([]ports.OutstandingBalance, error)
	RevenueBreakdowns(ctx context.Context, cmd analyticsapp.Command) (analyticsapp.RevenueBreakdownsResult, error)
	DesignPerformance(ctx context.Context, cmd analyticsapp.Command) ([]ports.DesignPerformance, error)
	Staff(ctx context.Context, cmd analyticsapp.Command) ([]ports.StaffActivity, error)
}

type Handler struct {
	service       Service
	authenticator authhttp.Authenticator
}

func NewHandler(service Service, authenticator authhttp.Authenticator) Handler {
	return Handler{service: service, authenticator: authenticator}
}

func (handler Handler) Register(router chi.Router) {
	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticator.Middleware)
		protected.Get("/analytics/summary", handler.summary)
		protected.Get("/analytics/sales-trend", handler.salesTrend)
		protected.Get("/analytics/orders-trend", handler.ordersTrend)
		protected.Get("/analytics/top-designs", handler.topDesigns)
		protected.Get("/analytics/customers", handler.customers)
		protected.Get("/analytics/outstanding-balances", handler.outstandingBalances)
		protected.Get("/analytics/revenue-breakdowns", handler.revenueBreakdowns)
		protected.Get("/analytics/design-performance", handler.designPerformance)
		protected.Get("/analytics/staff", handler.staff)
	})
}

// command builds the shared analytics command from the verified principal and
// the optional custom range (§14.1 Studio-only; the service enforces it).
func (handler Handler) command(r *http.Request) (analyticsapp.Command, bool) {
	principal, ok := authhttp.PrincipalFromContext(r.Context())
	if !ok {
		return analyticsapp.Command{}, false
	}
	query := r.URL.Query()
	return analyticsapp.Command{
		Scope:     principal.TenantScope(),
		ActorRole: principal.Role,
		From:      query.Get("from"),
		To:        query.Get("to"),
	}, true
}

func queryLimit(r *http.Request) int {
	raw := r.URL.Query().Get("limit")
	if raw == "" {
		return 0
	}
	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return limit
}

func (handler Handler) summary(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.Summary(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	statuses := make([]map[string]any, 0, len(result.Totals.OrdersByStatus))
	for _, bucket := range result.Totals.OrdersByStatus {
		statuses = append(statuses, map[string]any{"status": bucket.Status, "count": bucket.Count})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"window":            windowResponse(result.Window),
		"sales_total_minor": result.Totals.SalesTotalMinor,
		"orders_count":      result.Totals.OrdersCount,
		"orders_by_status":  statuses,
		"customers_count":   result.Totals.CustomersCount,
		"designs_count":     result.Totals.DesignsCount,
	})
}

func (handler Handler) salesTrend(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.SalesTrend(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	points := make([]map[string]any, 0, len(result.Points))
	for _, point := range result.Points {
		points = append(points, map[string]any{
			"day":                  dayString(point.Day),
			"sales_minor":          point.SalesMinor,
			"manual_takings_minor": point.ManualTakingsMinor,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"window": windowResponse(result.Window), "points": points})
}

func (handler Handler) ordersTrend(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.OrdersTrend(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	points := make([]map[string]any, 0, len(result.Points))
	for _, point := range result.Points {
		points = append(points, map[string]any{
			"day":      dayString(point.Day),
			"orders":   point.Orders,
			"standard": point.Standard,
			"bespoke":  point.Bespoke,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"window": windowResponse(result.Window), "points": points})
}

func (handler Handler) topDesigns(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.TopDesigns(r.Context(), cmd, queryLimit(r))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	designs := make([]map[string]any, 0, len(result.Designs))
	for _, design := range result.Designs {
		designs = append(designs, map[string]any{
			"design_id":     design.DesignID.String(),
			"title":         design.Title,
			"orders":        design.Orders,
			"revenue_minor": design.RevenueMinor,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"window":  windowResponse(result.Window),
		"limit":   result.LimitApplied,
		"designs": designs,
	})
}

func (handler Handler) customers(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.Customers(r.Context(), cmd, queryLimit(r))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	// Per-tier shape (§14.1): standard renders the mix; full+ additionally the
	// repeat rate, top customers and growth series.
	response := map[string]any{
		"window":              windowResponse(result.Window),
		"analytics_level":     result.Level,
		"new_customers":       result.Mix.NewInWindow,
		"returning_customers": result.Mix.ReturningInWindow,
	}
	if result.Level >= analyticsapp.LevelFull {
		response["repeat_rate"] = result.RepeatRate
		top := make([]map[string]any, 0, len(result.TopCustomers))
		for _, customer := range result.TopCustomers {
			top = append(top, map[string]any{
				"customer_id":   customer.CustomerID.String(),
				"display_name":  customer.DisplayName,
				"phone":         customer.Phone,
				"orders":        customer.Orders,
				"spend_minor":   customer.SpendMinor,
				"last_order_at": customer.LastOrderAt.Format(time.RFC3339),
			})
		}
		response["top_customers"] = top
		growth := make([]map[string]any, 0, len(result.Growth))
		for _, point := range result.Growth {
			growth = append(growth, map[string]any{
				"month":         point.Month.Format("2006-01"),
				"new_customers": point.NewCustomers,
			})
		}
		response["growth"] = growth
	}
	writeJSON(w, http.StatusOK, response)
}

func (handler Handler) outstandingBalances(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	balances, err := handler.service.OutstandingBalances(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(balances))
	var total int64
	for _, balance := range balances {
		total += balance.OutstandingMinor
		out = append(out, map[string]any{
			"order_id":           balance.OrderID.String(),
			"customer_name":      balance.CustomerName,
			"design_title":       balance.DesignTitle,
			"status":             balance.Status,
			"agreed_total_minor": balance.AgreedTotalMinor,
			"settled_minor":      balance.SettledMinor,
			"outstanding_minor":  balance.OutstandingMinor,
			"created_at":         balance.CreatedAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"balances":                out,
		"total_outstanding_minor": total,
	})
}

func (handler Handler) revenueBreakdowns(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	result, err := handler.service.RevenueBreakdowns(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	byDesign := make([]map[string]any, 0, len(result.Breakdowns.ByDesign))
	for _, row := range result.Breakdowns.ByDesign {
		byDesign = append(byDesign, map[string]any{
			"design_id": row.DesignID.String(), "title": row.Title,
			"orders": row.Orders, "revenue_minor": row.RevenueMinor,
		})
	}
	byCollection := make([]map[string]any, 0, len(result.Breakdowns.ByCollection))
	for _, row := range result.Breakdowns.ByCollection {
		var id *string
		if row.CollectionID != nil {
			s := row.CollectionID.String()
			id = &s
		}
		byCollection = append(byCollection, map[string]any{
			"collection_id": id, "name": row.Name,
			"orders": row.Orders, "revenue_minor": row.RevenueMinor,
		})
	}
	byFlow := make([]map[string]any, 0, len(result.Breakdowns.ByFlow))
	for _, row := range result.Breakdowns.ByFlow {
		byFlow = append(byFlow, map[string]any{
			"flow": row.Flow, "orders": row.Orders, "revenue_minor": row.RevenueMinor,
		})
	}
	byFulfilment := make([]map[string]any, 0, len(result.Breakdowns.ByFulfilment))
	for _, row := range result.Breakdowns.ByFulfilment {
		byFulfilment = append(byFulfilment, map[string]any{
			"method": row.Method, "orders": row.Orders, "revenue_minor": row.RevenueMinor,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"window":        windowResponse(result.Window),
		"by_design":     byDesign,
		"by_collection": byCollection,
		"by_flow":       byFlow,
		"by_fulfilment": byFulfilment,
	})
}

func (handler Handler) designPerformance(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	performance, err := handler.service.DesignPerformance(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(performance))
	for _, design := range performance {
		out = append(out, map[string]any{
			"design_id":       design.DesignID.String(),
			"title":           design.Title,
			"views":           design.Views,
			"orders":          design.Orders,
			"conversion_rate": design.ConversionRate,
			"waiting_list":    design.WaitingList,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"designs": out})
}

func (handler Handler) staff(w http.ResponseWriter, r *http.Request) {
	cmd, ok := handler.command(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}
	staff, err := handler.service.Staff(r.Context(), cmd)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(staff))
	for _, member := range staff {
		out = append(out, map[string]any{
			"user_id":        member.UserID.String(),
			"display_name":   member.DisplayName,
			"role":           member.Role,
			"is_active":      member.IsActive,
			"orders_created": member.OrdersCreated,
			"takings_logged": member.TakingsLogged,
			"takings_minor":  member.TakingsMinor,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"staff": out,
		"note":  "Orders and takings logged before staff attribution existed (migration 000109) are unattributed.",
	})
}

// windowResponse echoes the applied window; from is null for full-history
// plans (§14.1).
func windowResponse(window ports.AnalyticsWindow) map[string]any {
	var from any
	if window.From != nil {
		from = window.From.Format(time.RFC3339)
	}
	return map[string]any{"from": from, "to": window.To.Format(time.RFC3339)}
}

func dayString(day time.Time) string {
	return day.Format("2006-01-02")
}

// writeServiceError maps the analytics error vocabulary. The entitlement
// refusal carries the plan's current level so the dashboard can render a
// targeted upgrade prompt (§14.1 ladders by level).
func writeServiceError(w http.ResponseWriter, err error) {
	var notEntitled analyticsapp.NotEntitledError
	switch {
	case errors.As(err, &notEntitled):
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error":                "analytics_not_entitled",
			"feature":              notEntitled.Feature,
			"analytics_level":      notEntitled.CurrentLevel,
			"analytics_level_name": business.CapabilityLevel(notEntitled.CurrentLevel),
			"required_level":       notEntitled.RequiredLevel,
			"required_level_name":  business.CapabilityLevel(notEntitled.RequiredLevel),
		})
	case errors.Is(err, authdomain.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, analyticsapp.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "invalid_input")
	default:
		writeError(w, http.StatusInternalServerError, "internal_error")
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
