package money

import "errors"

// DepositFloorMinor is both the default custom-order deposit and the hard floor:
// GHS 100 = 10000 pesewas. Neither a store default nor a per-design override may
// be set below it (Technical Specification section 9.3).
const DepositFloorMinor int64 = 10000

var ErrDepositBelowFloor = errors.New("deposit may not be set below the platform floor")

// ValidateDepositConfig rejects a store default or per-design override set below
// the floor, at the point it is set.
func ValidateDepositConfig(amountMinor int64) error {
	if amountMinor < DepositFloorMinor {
		return ErrDepositBelowFloor
	}
	return nil
}

// ResolveDeposit returns the deposit due for a custom order, by strict
// precedence: the design override if set, otherwise the store default if set,
// otherwise the platform floor. The result is always at least the floor (a
// safety net; set values are validated against the floor when configured).
// Use a nil pointer for "not set".
func ResolveDeposit(designOverrideMinor *int64, storeDefaultMinor *int64) int64 {
	switch {
	case designOverrideMinor != nil:
		return atLeastFloor(*designOverrideMinor)
	case storeDefaultMinor != nil:
		return atLeastFloor(*storeDefaultMinor)
	default:
		return DepositFloorMinor
	}
}

func atLeastFloor(amountMinor int64) int64 {
	if amountMinor < DepositFloorMinor {
		return DepositFloorMinor
	}
	return amountMinor
}
