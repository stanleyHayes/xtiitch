package checkouthttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	checkoutapp "github.com/xcreativs/xtiitch/apps/api/internal/application/checkout"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

const maxBodyBytes = 1 << 20

type Service interface {
	PlaceStandardOrder(ctx context.Context, command checkoutapp.PlaceStandardOrderCommand) (checkoutapp.PlaceStandardOrderResult, error)
	PlaceCustomOrder(ctx context.Context, command checkoutapp.PlaceCustomOrderCommand) (checkoutapp.PlaceCustomOrderResult, error)
}

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/public/stores/{handle}/orders", handler.placeOrder)
	router.Post("/public/stores/{handle}/custom-orders", handler.placeCustomOrder)
}

type placeOrderBody struct {
	DesignHandle  string `json:"design_handle"`
	SizeBandID    string `json:"size_band_id"`
	CustomerName  string `json:"customer_name"`
	CustomerPhone string `json:"customer_phone"`
	CustomerEmail string `json:"customer_email"`
	Method        string `json:"method"`
}

func (handler Handler) placeOrder(w http.ResponseWriter, r *http.Request) {
	var body placeOrderBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.PlaceStandardOrder(r.Context(), checkoutapp.PlaceStandardOrderCommand{
		StoreHandle:   chi.URLParam(r, "handle"),
		DesignHandle:  body.DesignHandle,
		SizeBandID:    common.ID(body.SizeBandID),
		CustomerName:  body.CustomerName,
		CustomerPhone: body.CustomerPhone,
		CustomerEmail: body.CustomerEmail,
		Method:        money.PaymentMethod(body.Method),
	})
	if err != nil {
		status, code := checkoutError(err)
		writeError(w, status, code)
		return
	}

	writeOrderResult(w, result.OrderID.String(), result.Reference, result.AuthorizationURL, result.AmountMinor)
}

type placeCustomOrderBody struct {
	DesignHandle  string            `json:"design_handle"`
	SizeMode      string            `json:"size_mode"`
	CustomerName  string            `json:"customer_name"`
	CustomerPhone string            `json:"customer_phone"`
	CustomerEmail string            `json:"customer_email"`
	Method        string            `json:"method"`
	Measurements  map[string]string `json:"measurements"`
}

func (handler Handler) placeCustomOrder(w http.ResponseWriter, r *http.Request) {
	var body placeCustomOrderBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.PlaceCustomOrder(r.Context(), checkoutapp.PlaceCustomOrderCommand{
		StoreHandle:   chi.URLParam(r, "handle"),
		DesignHandle:  body.DesignHandle,
		SizeMode:      body.SizeMode,
		CustomerName:  body.CustomerName,
		CustomerPhone: body.CustomerPhone,
		CustomerEmail: body.CustomerEmail,
		Method:        money.PaymentMethod(body.Method),
		Measurements:  body.Measurements,
	})
	if err != nil {
		status, code := checkoutError(err)
		writeError(w, status, code)
		return
	}

	writeOrderResult(w, result.OrderID.String(), result.Reference, result.AuthorizationURL, result.AmountMinor)
}

func writeOrderResult(w http.ResponseWriter, orderID, reference, authorizationURL string, amountMinor int64) {
	writeJSON(w, http.StatusCreated, map[string]any{
		"order_id":          orderID,
		"reference":         reference,
		"authorization_url": authorizationURL,
		"amount_minor":      amountMinor,
	})
}

func checkoutError(err error) (int, string) {
	switch {
	case errors.Is(err, checkoutapp.ErrInvalidInput), errors.Is(err, checkoutapp.ErrBandUnavailable),
		errors.Is(err, checkoutapp.ErrInvalidSizeMode), errors.Is(err, checkoutapp.ErrInvalidMeasurements):
		return http.StatusBadRequest, "invalid_order"
	case errors.Is(err, checkoutapp.ErrStoreNotFound), errors.Is(err, checkoutapp.ErrDesignUnavailable):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, checkoutapp.ErrNotVerified):
		return http.StatusConflict, "store_not_verified"
	case errors.Is(err, checkoutapp.ErrBespokeDisabled), errors.Is(err, checkoutapp.ErrMeasurementsDisabled):
		return http.StatusConflict, "store_cannot_take_order"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func decodeJSON(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	var trailing struct{}
	if err := decoder.Decode(&trailing); err != io.EOF {
		return errors.New("request body must contain a single JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
