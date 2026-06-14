package common

import "errors"

const CurrencyGHS = "GHS"

var (
	ErrNegativeMoney    = errors.New("money amount cannot be negative")
	ErrCurrencyMismatch = errors.New("money currency mismatch")
)

type Money struct {
	Currency  string
	MinorUnit int64
}

func NewGHSMoney(minorUnit int64) (Money, error) {
	if minorUnit < 0 {
		return Money{}, ErrNegativeMoney
	}

	return Money{
		Currency:  CurrencyGHS,
		MinorUnit: minorUnit,
	}, nil
}

func (m Money) Add(other Money) (Money, error) {
	if m.Currency != other.Currency {
		return Money{}, ErrCurrencyMismatch
	}

	return Money{
		Currency:  m.Currency,
		MinorUnit: m.MinorUnit + other.MinorUnit,
	}, nil
}
