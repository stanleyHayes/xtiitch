package checkouthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	checkoutapp "github.com/xcreativs/xtiitch/apps/api/internal/application/checkout"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

// checkoutQuote prices a basket's §4.2–§4.6 fee breakdown for the storefront to
// render before the customer pays. It accepts the same payload shape as
// cart-orders (the customer fields are ignored: they do not affect pricing).
func (handler Handler) checkoutQuote(w http.ResponseWriter, r *http.Request) {
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
			Note:         item.Note,
		})
	}

	result, err := handler.service.CheckoutQuote(r.Context(), checkoutapp.CheckoutQuoteCommand{
		StoreHandle:    chi.URLParam(r, "handle"),
		Lines:          lines,
		DeliveryZoneID: common.ID(body.DeliveryZoneID),
	})
	if err != nil {
		status, code := checkoutError(err)
		writeError(w, status, code)
		return
	}

	quoteLines := make([]checkoutQuoteLineResponse, 0, len(result.Lines))
	for _, line := range result.Lines {
		quoteLines = append(quoteLines, checkoutQuoteLineResponse{
			DesignHandle: line.DesignHandle,
			Kind:         string(line.Kind),
			AmountMinor:  line.AmountMinor,
		})
	}
	writeJSON(w, http.StatusOK, checkoutQuoteResponse{
		Currency:            common.CurrencyGHS,
		Lines:               quoteLines,
		DeliveryFeeMinor:    result.DeliveryFeeMinor,
		ItemsTotalMinor:     result.Quote.ItemsTotalMinor,
		VATRateBps:          result.Quote.VATRateBps,
		TransactionFeeMinor: result.Quote.TransactionFeeMinor,
		TaxMinor:            result.Quote.TaxLineMinor,
		TotalMinor:          result.Quote.TotalChargeMinor,
	})
}

type checkoutQuoteLineResponse struct {
	DesignHandle string `json:"design_handle"`
	Kind         string `json:"kind"`
	AmountMinor  int64  `json:"amount_minor"`
}

// checkoutQuoteResponse is the read-only §4.5 breakdown, all GHS minor units.
// transaction_fee_minor is the combined "Transaction fee" line and tax_minor
// the "Tax (VAT)" line (§4.5 naming); both are 0 when the owner absorbs the
// fees, so the customer then sees only the items total.
type checkoutQuoteResponse struct {
	Currency            string                      `json:"currency"`
	Lines               []checkoutQuoteLineResponse `json:"lines"`
	DeliveryFeeMinor    int64                       `json:"delivery_fee_minor"`
	ItemsTotalMinor     int64                       `json:"items_total_minor"`
	VATRateBps          int                         `json:"vat_rate_bps"`
	TransactionFeeMinor int64                       `json:"transaction_fee_minor"`
	TaxMinor            int64                       `json:"tax_minor"`
	TotalMinor          int64                       `json:"total_minor"`
}
