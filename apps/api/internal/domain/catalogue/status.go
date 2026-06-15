package catalogue

import "errors"

// Status is the three-state lifecycle for designs and collections. Retiring
// hides an item from the public store but keeps it; deleting is a deliberate,
// terminal soft state that preserves order integrity (Technical Specification
// section 4.7.1).
type Status string

const (
	StatusActive  Status = "active"
	StatusRetired Status = "retired"
	StatusDeleted Status = "deleted"
)

var ErrInvalidStatusTransition = errors.New("invalid catalogue status transition")

func (s Status) Valid() bool {
	switch s {
	case StatusActive, StatusRetired, StatusDeleted:
		return true
	default:
		return false
	}
}

// IsPublic reports whether an item with this status appears on the public store.
// Only active items are ever public.
func (s Status) IsPublic() bool {
	return s == StatusActive
}

func (s Status) CanRetire() bool  { return s == StatusActive }
func (s Status) CanRestore() bool { return s == StatusRetired }
func (s Status) CanDelete() bool  { return s != StatusDeleted }
