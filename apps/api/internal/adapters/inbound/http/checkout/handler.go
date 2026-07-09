package checkouthttp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	checkoutapp "github.com/xcreativs/xtiitch/apps/api/internal/application/checkout"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

const maxBodyBytes = 1 << 20

type Service interface {
	PlaceStandardOrder(ctx context.Context, command checkoutapp.PlaceStandardOrderCommand) (checkoutapp.PlaceStandardOrderResult, error)
	PlaceCartOrder(ctx context.Context, command checkoutapp.PlaceCartOrderCommand) (checkoutapp.PlaceCartOrderResult, error)
	PlaceCustomOrder(ctx context.Context, command checkoutapp.PlaceCustomOrderCommand) (checkoutapp.PlaceCustomOrderResult, error)
	PlaceHomeVisitBooking(ctx context.Context, command checkoutapp.PlaceHomeVisitBookingCommand) (checkoutapp.PlaceHomeVisitBookingResult, error)
	StoreDeliveryZones(ctx context.Context, storeHandle string) ([]ports.DeliveryZone, error)
}

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (handler Handler) Register(router chi.Router) {
	router.Post("/public/stores/{handle}/orders", handler.placeOrder)
	router.Post("/public/stores/{handle}/cart-orders", handler.placeCartOrder)
	router.Get("/public/stores/{handle}/delivery-zones", handler.listDeliveryZones)
	router.Post("/public/stores/{handle}/custom-orders", handler.placeCustomOrder)
	router.Post("/public/stores/{handle}/bookings", handler.placeBooking)
}

func (handler Handler) listDeliveryZones(w http.ResponseWriter, r *http.Request) {
	zones, err := handler.service.StoreDeliveryZones(r.Context(), chi.URLParam(r, "handle"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	out := make([]map[string]any, 0, len(zones))
	for _, z := range zones {
		out = append(out, map[string]any{
			"zone_id":   z.ID.String(),
			"name":      z.Name,
			"fee_minor": z.FeeMinor,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"zones": out})
}

type placeOrderBody struct {
	DesignHandle       string `json:"design_handle"`
	SizeBandID         string `json:"size_band_id"`
	CustomerName       string `json:"customer_name"`
	CustomerPhone      string `json:"customer_phone"`
	CustomerWhatsApp   string `json:"customer_whatsapp"`
	CustomerEmail      string `json:"customer_email"`
	Method             string `json:"method"`
	PromoCode          string `json:"promo_code"`
	AffiliateCode      string `json:"affiliate_code"`
	AffiliateClickID   string `json:"affiliate_click_id"`
	AffiliateVisitorID string `json:"affiliate_visitor_id"`
	ReferralCode       string `json:"referral_code"`
}

func (handler Handler) placeOrder(w http.ResponseWriter, r *http.Request) {
	var body placeOrderBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.PlaceStandardOrder(r.Context(), checkoutapp.PlaceStandardOrderCommand{
		StoreHandle:        chi.URLParam(r, "handle"),
		DesignHandle:       body.DesignHandle,
		SizeBandID:         common.ID(body.SizeBandID),
		CustomerName:       body.CustomerName,
		CustomerPhone:      body.CustomerPhone,
		CustomerWhatsApp:   body.CustomerWhatsApp,
		CustomerEmail:      body.CustomerEmail,
		Method:             money.PaymentMethod(body.Method),
		PromoCode:          body.PromoCode,
		AffiliateCode:      body.AffiliateCode,
		AffiliateClickID:   common.ID(body.AffiliateClickID),
		AffiliateVisitorID: body.AffiliateVisitorID,
		ReferralCode:       body.ReferralCode,
	})
	if err != nil {
		status, code := checkoutError(err)
		writeError(w, status, code)
		return
	}

	writeOrderResult(w, result.OrderID.String(), result.Reference, result.AuthorizationURL, result.AmountMinor, result.DiscountMinor)
}

type cartLineBody struct {
	DesignHandle string            `json:"design_handle"`
	SizeBandID   string            `json:"size_band_id"`
	Kind         string            `json:"kind"`
	SizeMode     string            `json:"size_mode"`
	Measurements map[string]string `json:"measurements"`
}

type placeCartOrderBody struct {
	Items            []cartLineBody `json:"items"`
	CustomerName     string         `json:"customer_name"`
	CustomerPhone    string         `json:"customer_phone"`
	CustomerWhatsApp string         `json:"customer_whatsapp"`
	CustomerEmail    string         `json:"customer_email"`
	Method           string         `json:"method"`
	DeliveryZoneID   string         `json:"delivery_zone_id"`
	DeliveryAddress  string         `json:"delivery_address"`
}

func (handler Handler) placeCartOrder(w http.ResponseWriter, r *http.Request) {
	var body placeCartOrderBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	lines := make([]checkoutapp.CartLineCommand, 0, len(body.Items))
	for _, item := range body.Items {
		lines = append(lines, checkoutapp.CartLineCommand{
			DesignHandle: item.DesignHandle,
			SizeBandID:   common.ID(item.SizeBandID),
			Kind:         checkoutapp.CartLineKind(item.Kind),
			SizeMode:     order.SizeMode(item.SizeMode),
			Measurements: item.Measurements,
		})
	}

	result, err := handler.service.PlaceCartOrder(r.Context(), checkoutapp.PlaceCartOrderCommand{
		StoreHandle:      chi.URLParam(r, "handle"),
		Lines:            lines,
		CustomerName:     body.CustomerName,
		CustomerPhone:    body.CustomerPhone,
		CustomerWhatsApp: body.CustomerWhatsApp,
		CustomerEmail:    body.CustomerEmail,
		Method:           money.PaymentMethod(body.Method),
		DeliveryZoneID:   common.ID(body.DeliveryZoneID),
		DeliveryAddress:  body.DeliveryAddress,
	})
	if err != nil {
		status, code := checkoutError(err)
		writeError(w, status, code)
		return
	}

	writeOrderResult(w, result.OrderID.String(), result.Reference, result.AuthorizationURL, result.AmountMinor, 0)
}

type placeCustomOrderBody struct {
	DesignHandle       string            `json:"design_handle"`
	SizeMode           string            `json:"size_mode"`
	CustomerName       string            `json:"customer_name"`
	CustomerPhone      string            `json:"customer_phone"`
	CustomerWhatsApp   string            `json:"customer_whatsapp"`
	CustomerEmail      string            `json:"customer_email"`
	Method             string            `json:"method"`
	PromoCode          string            `json:"promo_code"`
	AffiliateCode      string            `json:"affiliate_code"`
	AffiliateClickID   string            `json:"affiliate_click_id"`
	AffiliateVisitorID string            `json:"affiliate_visitor_id"`
	ReferralCode       string            `json:"referral_code"`
	Measurements       map[string]string `json:"measurements"`
}

func (handler Handler) placeCustomOrder(w http.ResponseWriter, r *http.Request) {
	var body placeCustomOrderBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.PlaceCustomOrder(r.Context(), checkoutapp.PlaceCustomOrderCommand{
		StoreHandle:        chi.URLParam(r, "handle"),
		DesignHandle:       body.DesignHandle,
		SizeMode:           body.SizeMode,
		CustomerName:       body.CustomerName,
		CustomerPhone:      body.CustomerPhone,
		CustomerWhatsApp:   body.CustomerWhatsApp,
		CustomerEmail:      body.CustomerEmail,
		Method:             money.PaymentMethod(body.Method),
		PromoCode:          body.PromoCode,
		AffiliateCode:      body.AffiliateCode,
		AffiliateClickID:   common.ID(body.AffiliateClickID),
		AffiliateVisitorID: body.AffiliateVisitorID,
		ReferralCode:       body.ReferralCode,
		Measurements:       body.Measurements,
	})
	if err != nil {
		status, code := checkoutError(err)
		writeError(w, status, code)
		return
	}

	writeOrderResult(w, result.OrderID.String(), result.Reference, result.AuthorizationURL, result.AmountMinor, result.DiscountMinor)
}

type placeBookingBody struct {
	DesignHandle       string `json:"design_handle"`
	CustomerName       string `json:"customer_name"`
	CustomerPhone      string `json:"customer_phone"`
	CustomerWhatsApp   string `json:"customer_whatsapp"`
	CustomerEmail      string `json:"customer_email"`
	Method             string `json:"method"`
	AffiliateCode      string `json:"affiliate_code"`
	AffiliateClickID   string `json:"affiliate_click_id"`
	AffiliateVisitorID string `json:"affiliate_visitor_id"`
	ReferralCode       string `json:"referral_code"`
	SlotStart          string `json:"slot_start"`
	Address            string `json:"address"`
}

func (handler Handler) placeBooking(w http.ResponseWriter, r *http.Request) {
	var body placeBookingBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	slotStart, err := time.Parse(time.RFC3339, body.SlotStart)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	result, err := handler.service.PlaceHomeVisitBooking(r.Context(), checkoutapp.PlaceHomeVisitBookingCommand{
		StoreHandle:        chi.URLParam(r, "handle"),
		DesignHandle:       body.DesignHandle,
		CustomerName:       body.CustomerName,
		CustomerPhone:      body.CustomerPhone,
		CustomerWhatsApp:   body.CustomerWhatsApp,
		CustomerEmail:      body.CustomerEmail,
		Method:             money.PaymentMethod(body.Method),
		AffiliateCode:      body.AffiliateCode,
		AffiliateClickID:   common.ID(body.AffiliateClickID),
		AffiliateVisitorID: body.AffiliateVisitorID,
		ReferralCode:       body.ReferralCode,
		SlotStart:          slotStart,
		Address:            body.Address,
	})
	if err != nil {
		status, code := checkoutError(err)
		writeError(w, status, code)
		return
	}

	writeOrderResult(w, result.OrderID.String(), result.Reference, result.AuthorizationURL, result.AmountMinor, 0)
}

func writeOrderResult(w http.ResponseWriter, orderID, reference, authorizationURL string, amountMinor int64, discountMinor int64) {
	writeJSON(w, http.StatusCreated, map[string]any{
		"order_id":          orderID,
		"reference":         reference,
		"authorization_url": authorizationURL,
		"amount_minor":      amountMinor,
		"discount_minor":    discountMinor,
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
	case errors.Is(err, checkoutapp.ErrOnlineOrderingOff):
		return http.StatusConflict, "online_ordering_unavailable"
	case errors.Is(err, checkoutapp.ErrDeliveryUnavailable):
		return http.StatusConflict, "delivery_unavailable"
	case errors.Is(err, checkoutapp.ErrPromotionUnavailable):
		return http.StatusConflict, "promotion_unavailable"
	case errors.Is(err, ports.ErrSlotTaken), errors.Is(err, ports.ErrNoAvailability):
		return http.StatusConflict, "slot_unavailable"
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
