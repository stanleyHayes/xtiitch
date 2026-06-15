package ports

import "errors"

// ErrNotFound is the port-level "no such record" sentinel. Outbound repositories
// return it (or wrap it) so application services and inbound adapters can map a
// missing record to a 404 without depending on a specific data store.
var ErrNotFound = errors.New("not found")
