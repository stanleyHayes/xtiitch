package business

import "errors"

// ErrHandleTaken is returned when a business handle is already in use. The store
// handle is unique across the whole platform, so registration must surface this
// as a conflict rather than an opaque internal error.
var ErrHandleTaken = errors.New("business handle already taken")

// ErrUserEmailTaken is returned when a business tries to create another staff
// account with an email address already used inside that business.
var ErrUserEmailTaken = errors.New("business user email already taken")
