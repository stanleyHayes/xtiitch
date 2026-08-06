package authapp

import (
	"context"
	"log/slog"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func logAffiliateAttributionError(
	ctx context.Context,
	action string,
	subscription ports.BusinessSubscriptionRecord,
	paymentReference string,
	err error,
) {
	slog.ErrorContext(
		ctx,
		"subscription checkout: failed to "+action+" affiliate attribution",
		"business_id", subscription.BusinessID.String(),
		"subscription_id", subscription.SubscriptionID.String(),
		"payment_reference", paymentReference,
		"error", err,
	)
}
