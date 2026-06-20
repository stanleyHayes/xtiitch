// Package botcatalogueadapter adapts the existing storefront and order
// repositories to the narrow ports.BotCatalogue surface the WhatsApp bot's
// conversation engine consumes. It is pure mapping — no new persistence — so bot
// reads stay identical to the storefront's (shop resolution, active designs,
// public order tracking).
package botcatalogueadapter

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type Adapter struct {
	storefront ports.StorefrontRepository
	orders     ports.OrderRepository
}

func New(storefront ports.StorefrontRepository, orders ports.OrderRepository) Adapter {
	return Adapter{storefront: storefront, orders: orders}
}

func (a Adapter) ResolveShop(ctx context.Context, handle string) (ports.BotShop, error) {
	store, err := a.storefront.ResolveStore(ctx, handle)
	if err != nil {
		return ports.BotShop{}, err // ErrNotFound passes through unchanged
	}
	return ports.BotShop{
		BusinessID:     store.BusinessID.String(),
		Name:           store.Name,
		Handle:         store.Handle,
		OnlineOrdering: store.OnlineOrderingEnabled,
	}, nil
}

func (a Adapter) ListDesigns(ctx context.Context, businessID string) ([]ports.BotDesign, error) {
	designs, err := a.storefront.ListActiveDesigns(ctx, common.ID(businessID))
	if err != nil {
		return nil, err
	}
	out := make([]ports.BotDesign, 0, len(designs))
	for _, d := range designs {
		out = append(out, ports.BotDesign{
			Title:          d.Design.Title,
			Handle:         d.Design.Handle,
			FromPriceMinor: minPrice(d.Prices),
			Sizes:          sizeLabels(d.Prices),
		})
	}
	return out, nil
}

func (a Adapter) TrackOrder(ctx context.Context, code string) (ports.BotOrder, error) {
	tracking, err := a.orders.GetTracking(ctx, common.ID(code))
	if err != nil {
		return ports.BotOrder{}, err // ErrNotFound passes through unchanged
	}
	return ports.BotOrder{
		DesignTitle: tracking.DesignTitle,
		StoreName:   tracking.StoreName,
		Status:      string(tracking.Status),
		Stage:       tracking.StageName,
		Colour:      string(tracking.Colour),
	}, nil
}

// minPrice returns the lowest band price (the "from" price) in minor units, or 0
// when the design has no priced bands.
func minPrice(prices []catalogue.BandPrice) int64 {
	if len(prices) == 0 {
		return 0
	}
	min := prices[0].PriceMinor
	for _, p := range prices[1:] {
		if p.PriceMinor < min {
			min = p.PriceMinor
		}
	}
	return min
}

func sizeLabels(prices []catalogue.BandPrice) []string {
	out := make([]string, 0, len(prices))
	for _, p := range prices {
		if p.Label != "" {
			out = append(out, p.Label)
		}
	}
	return out
}
