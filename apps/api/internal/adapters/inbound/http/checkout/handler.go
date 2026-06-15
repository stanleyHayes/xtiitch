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
}

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/public/stores/{handle}/orders", handler.placeOrder)
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

	writeJSON(w, http.StatusCreated, map[string]any{
		"order_id":          result.OrderID.String(),
		"reference":         result.Reference,
		"authorization_url": result.AuthorizationURL,
		"amount_minor":      result.AmountMinor,
	})
}

func checkoutError(err error) (int, string) {
	switch {
	case errors.Is(err, checkoutapp.ErrInvalidInput), errors.Is(err, checkoutapp.ErrBandUnavailable):
		return http.StatusBadRequest, "invalid_order"
	case errors.Is(err, checkoutapp.ErrStoreNotFound), errors.Is(err, checkoutapp.ErrDesignUnavailable):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, checkoutapp.ErrNotVerified):
		return http.StatusConflict, "store_not_verified"
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
