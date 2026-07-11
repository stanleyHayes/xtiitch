package adminauthhttp

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type customerResponse struct {
	CustomerID         string `json:"customer_id"`
	Email              string `json:"email"`
	Phone              string `json:"phone"`
	DisplayName        string `json:"display_name"`
	TenantCount        int    `json:"tenant_count"`
	OrderCount         int    `json:"order_count"`
	CustomOrderCount   int    `json:"custom_order_count"`
	GMVMinor           int64  `json:"gmv_minor"`
	LastBusinessName   string `json:"last_business_name"`
	LastBusinessHandle string `json:"last_business_handle"`
	LastActive         string `json:"last_active"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

func (handler Handler) customers(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	records, err := handler.service.ListCustomers(r.Context(), adminauthapp.ListCustomersCommand{
		ActorRole: principal.Role,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	out := make([]customerResponse, 0, len(records))
	for _, record := range records {
		out = append(out, newCustomerResponse(record))
	}
	writeJSON(w, http.StatusOK, map[string][]customerResponse{"customers": out})
}

type customerExportBusiness struct {
	BusinessName   string `json:"business_name"`
	BusinessHandle string `json:"business_handle"`
	FirstSeenAt    string `json:"first_seen_at"`
}

type customerExportOrder struct {
	OrderID          string `json:"order_id"`
	BusinessName     string `json:"business_name"`
	DesignTitle      string `json:"design_title"`
	OrderType        string `json:"order_type"`
	Status           string `json:"status"`
	AgreedTotalMinor int64  `json:"agreed_total_minor"`
	CreatedAt        string `json:"created_at"`
}

type customerExportMeasurement struct {
	OrderID   string          `json:"order_id"`
	Source    string          `json:"source"`
	Values    json.RawMessage `json:"values"`
	CreatedAt string          `json:"created_at"`
}

type customerExportResponse struct {
	CustomerID   string                      `json:"customer_id"`
	Email        string                      `json:"email"`
	Phone        string                      `json:"phone"`
	DisplayName  string                      `json:"display_name"`
	CreatedAt    string                      `json:"created_at"`
	UpdatedAt    string                      `json:"updated_at"`
	Businesses   []customerExportBusiness    `json:"businesses"`
	Orders       []customerExportOrder       `json:"orders"`
	Measurements []customerExportMeasurement `json:"measurements"`
	ExportedAt   string                      `json:"exported_at"`
	Notice       string                      `json:"notice"`
}

func (handler Handler) exportCustomer(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	record, err := handler.service.ExportCustomerData(r.Context(), adminauthapp.ExportCustomerDataCommand{
		ActorRole:  principal.Role,
		CustomerID: common.ID(chi.URLParam(r, "id")),
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, newCustomerExportResponse(record))
}

type eraseCustomerRequest struct {
	Confirmation string `json:"confirmation"`
}

type customerErasureResponse struct {
	CustomerID          string `json:"customer_id"`
	Erased              bool   `json:"erased"`
	OrdersRetained      int    `json:"orders_retained"`
	MeasurementsCleared int    `json:"measurements_cleared"`
	BookingAddresses    int    `json:"booking_addresses_cleared"`
	Notice              string `json:"notice"`
}

func (handler Handler) eraseCustomer(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid_token")
		return
	}

	var request eraseCustomerRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	record, err := handler.service.EraseCustomerData(r.Context(), adminauthapp.EraseCustomerDataCommand{
		ActorUserID:  principal.AdminUserID,
		ActorRole:    principal.Role,
		CustomerID:   common.ID(chi.URLParam(r, "id")),
		Confirmation: request.Confirmation,
	})
	if err != nil {
		status, code := authError(err)
		writeError(w, status, code)
		return
	}

	writeJSON(w, http.StatusOK, customerErasureResponse{
		CustomerID:          record.CustomerID.String(),
		Erased:              true,
		OrdersRetained:      record.OrdersRetained,
		MeasurementsCleared: record.MeasurementsCleared,
		BookingAddresses:    record.BookingAddresses,
		Notice:              "Personal data anonymised platform-wide under the Data Protection Act, 2012 (Act 843). Order records are retained for accounting and reference the customer by opaque id only.",
	})
}

func newCustomerExportResponse(record ports.AdminCustomerExportRecord) customerExportResponse {
	businesses := make([]customerExportBusiness, 0, len(record.Businesses))
	for _, b := range record.Businesses {
		businesses = append(businesses, customerExportBusiness{
			BusinessName:   b.BusinessName,
			BusinessHandle: b.BusinessHandle,
			FirstSeenAt:    b.FirstSeenAt.Format(time.RFC3339),
		})
	}
	orders := make([]customerExportOrder, 0, len(record.Orders))
	for _, o := range record.Orders {
		orders = append(orders, customerExportOrder{
			OrderID:          o.OrderID.String(),
			BusinessName:     o.BusinessName,
			DesignTitle:      o.DesignTitle,
			OrderType:        o.OrderType,
			Status:           o.Status,
			AgreedTotalMinor: o.AgreedTotalMinor,
			CreatedAt:        o.CreatedAt.Format(time.RFC3339),
		})
	}
	measurements := make([]customerExportMeasurement, 0, len(record.Measurements))
	for _, m := range record.Measurements {
		values := json.RawMessage(m.Values)
		if len(values) == 0 {
			values = json.RawMessage("{}")
		}
		measurements = append(measurements, customerExportMeasurement{
			OrderID:   m.OrderID.String(),
			Source:    m.Source,
			Values:    values,
			CreatedAt: m.CreatedAt.Format(time.RFC3339),
		})
	}
	return customerExportResponse{
		CustomerID:   record.CustomerID.String(),
		Email:        record.Email,
		Phone:        record.Phone,
		DisplayName:  record.DisplayName,
		CreatedAt:    record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    record.UpdatedAt.Format(time.RFC3339),
		Businesses:   businesses,
		Orders:       orders,
		Measurements: measurements,
		ExportedAt:   time.Now().UTC().Format(time.RFC3339),
		Notice:       "Data Protection Act, 2012 (Act 843) subject-access export. Contains personal data — handle and transmit securely.",
	}
}

func newCustomerResponse(record ports.AdminCustomerRecord) customerResponse {
	return customerResponse{
		CustomerID:         record.CustomerID.String(),
		Email:              record.Email,
		Phone:              record.Phone,
		DisplayName:        fallbackText(record.DisplayName, "Unnamed customer"),
		TenantCount:        record.TenantCount,
		OrderCount:         record.OrderCount,
		CustomOrderCount:   record.CustomOrderCount,
		GMVMinor:           record.GMVMinor,
		LastBusinessName:   record.LastBusinessName,
		LastBusinessHandle: record.LastBusinessHandle,
		LastActive:         record.LastActiveAt.Format(time.RFC3339),
		CreatedAt:          record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          record.UpdatedAt.Format(time.RFC3339),
	}
}
