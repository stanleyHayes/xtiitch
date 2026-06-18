package orderapp

import (
	"context"
	"errors"
	"strings"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

var (
	ErrInvalidInput      = errors.New("invalid order input")
	ErrBalanceNotDue     = errors.New("no balance is due on this order")
	ErrBalanceInProgress = errors.New("a balance charge is already in progress for this order")
)

// Payments is the slice of the payments use case the order service needs to
// raise a balance charge.
type Payments interface {
	InitiateCharge(ctx context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error)
}

type Service struct {
	orders   ports.OrderRepository
	payments Payments
	ids      ports.IDGenerator
}

type Dependencies struct {
	Orders   ports.OrderRepository
	Payments Payments
	IDs      ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{orders: deps.Orders, payments: deps.Payments, ids: deps.IDs}
}

type CreateWalkInOrderCommand struct {
	Scope            common.TenantScope
	DesignID         common.ID
	SizeBandID       *common.ID
	CustomerName     string
	CustomerPhone    string
	CustomerEmail    string
	AgreedTotalMinor *int64
}

// CreateWalkInOrder records an in-person order against one of the business's
// designs and returns the order reference (the customer's tracking key).
func (s Service) CreateWalkInOrder(ctx context.Context, cmd CreateWalkInOrderCommand) (common.ID, error) {
	name := strings.TrimSpace(cmd.CustomerName)
	if cmd.DesignID == "" || name == "" {
		return "", ErrInvalidInput
	}

	orderID := s.ids.NewID()
	err := s.orders.CreateWalkInOrder(ctx, cmd.Scope, ports.CreateWalkInOrderInput{
		OrderID:          orderID,
		BusinessID:       cmd.Scope.BusinessID,
		CustomerID:       s.ids.NewID(),
		DesignID:         cmd.DesignID,
		SizeBandID:       cmd.SizeBandID,
		CustomerName:     name,
		CustomerPhone:    strings.TrimSpace(cmd.CustomerPhone),
		CustomerEmail:    strings.TrimSpace(cmd.CustomerEmail),
		AgreedTotalMinor: cmd.AgreedTotalMinor,
	})
	return orderID, err
}

func (s Service) ListOrders(ctx context.Context, scope common.TenantScope) ([]ports.OrderSummary, error) {
	return s.orders.ListOrders(ctx, scope)
}

func (s Service) AdvanceStage(ctx context.Context, scope common.TenantScope, orderID common.ID) (order.Tracking, error) {
	return s.orders.AdvanceStage(ctx, scope, orderID)
}

// GetTracking is the public "where is my cloth?" read, keyed by order reference.
func (s Service) GetTracking(ctx context.Context, orderID common.ID) (order.Tracking, error) {
	return s.orders.GetTracking(ctx, orderID)
}

// SetAgreedTotal records the negotiated total for a confirmed custom order, so
// its outstanding balance can later be collected. The repository enforces that
// the order is a confirmed custom order and the total is not below what has
// already been settled (ports.ErrInvalidOrderState otherwise).
type SetAgreedTotalCommand struct {
	Scope            common.TenantScope
	ActorRole        business.UserRole
	OrderID          common.ID
	AgreedTotalMinor int64
}

func (s Service) SetAgreedTotal(ctx context.Context, cmd SetAgreedTotalCommand) error {
	if err := authorizeOrderMoneyManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.AgreedTotalMinor <= 0 {
		return ErrInvalidInput
	}
	return s.orders.SetAgreedTotal(ctx, cmd.Scope, cmd.OrderID, cmd.AgreedTotalMinor)
}

type CollectBalanceResult struct {
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
}

// CollectBalance raises a balance charge for the outstanding amount on a
// confirmed custom order (agreed total minus what is already settled) over the
// money rails. The balance payment is recorded as initiated and credited to the
// order only by its confirmed webhook, which caps settlement at the agreed total.
type CollectBalanceCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	OrderID   common.ID
	Method    money.PaymentMethod
}

func (s Service) CollectBalance(ctx context.Context, cmd CollectBalanceCommand) (CollectBalanceResult, error) {
	if err := authorizeOrderMoneyManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return CollectBalanceResult{}, err
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return CollectBalanceResult{}, ErrInvalidInput
	}

	billing, err := s.orders.GetOrderBilling(ctx, cmd.Scope, cmd.OrderID)
	if err != nil {
		return CollectBalanceResult{}, err
	}
	if billing.OrderType != string(order.TypeCustom) ||
		billing.Status != string(order.StatusConfirmed) ||
		billing.AgreedTotalMinor == nil ||
		billing.CustomerEmail == "" {
		return CollectBalanceResult{}, ErrBalanceNotDue
	}
	// Refuse if a balance charge is already pending: otherwise a double-submit
	// raises a second charge and the customer pays twice while the order ledger's
	// cap hides the over-collection. The DB partial unique index is the race-proof
	// backstop behind this check.
	if billing.BalanceInFlight {
		return CollectBalanceResult{}, ErrBalanceInProgress
	}
	balance := *billing.AgreedTotalMinor - billing.SettledMinor
	if balance <= 0 {
		return CollectBalanceResult{}, ErrBalanceNotDue
	}

	chargeMethod := cmd.Method
	if chargeMethod == "" {
		chargeMethod = money.PaymentMethodMomo
	}
	charge, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:         cmd.Scope,
		OrderID:       &cmd.OrderID,
		Purpose:       money.PaymentPurposeBalance,
		AmountMinor:   balance,
		Method:        chargeMethod,
		CustomerEmail: billing.CustomerEmail,
	})
	if err != nil {
		// The race backstop fired between the check above and the insert.
		if errors.Is(err, ports.ErrPaymentInFlight) {
			return CollectBalanceResult{}, ErrBalanceInProgress
		}
		return CollectBalanceResult{}, err
	}
	return CollectBalanceResult{
		Reference:        charge.Reference,
		AuthorizationURL: charge.AuthorizationURL,
		AmountMinor:      balance,
	}, nil
}

func authorizeOrderMoneyManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return ErrInvalidInput
	}
	if role == business.UserRoleOwner || role == business.UserRoleAdmin {
		return nil
	}
	return authdomain.ErrForbidden
}
