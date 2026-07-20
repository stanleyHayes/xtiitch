package crmapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ListCommand is the §15.1 customer-list request: the caller's tenant + role,
// the ladder-gated query params, and limit/offset paging.
type ListCommand struct {
	Scope           common.TenantScope
	ActorRole       business.UserRole
	Q               string
	Tag             string
	Segment         string
	MinSpendMinor   *int64
	LastOrderBefore string
	LastOrderAfter  string
	Limit           int
	Offset          int
}

// ListResult echoes the applied CRM level (so the dashboard can render the
// tier-appropriate columns) plus one page and the page-independent total.
type ListResult struct {
	Level     int
	Customers []ports.CRMCustomerRow
	Total     int
	Limit     int
	Offset    int
}

// ListCustomers serves GET /v1/crm/customers (§15.1: the list itself is on
// EVERY plan — "the address book"). Ladder enforcement (spec-exact):
//   - search (q) is Starter+ (level ≥ 1): a basic plan passing q gets a 403,
//     not a silently unfiltered list;
//   - tag / segment / min_spend / last-order filters are Growth+ (level ≥ 2);
//   - spend & order counts ladder to Starter, so basic-plan rows carry zeros
//     (§15.1 "Total spend & order count per customer" is a Starter rung —
//     Free sees the address book without the money figures);
//   - tags on rows are Growth+.
func (s Service) ListCustomers(ctx context.Context, cmd ListCommand) (ListResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelBasic, "customer_list")
	if err != nil {
		return ListResult{}, err
	}
	level := crmLevel(profile)

	query := ports.CRMCustomerQuery{
		Now:    s.clock.Now(),
		Limit:  cmd.Limit,
		Offset: cmd.Offset,
	}
	if query.Limit == 0 {
		query.Limit = defaultListLimit
	}
	if query.Limit < 0 || query.Limit > maxListLimit || query.Offset < 0 {
		return ListResult{}, ErrInvalidInput
	}

	if q := strings.TrimSpace(cmd.Q); q != "" {
		if level < LevelStandard {
			return ListResult{}, NotEntitledError{Feature: "search", RequiredLevel: LevelStandard, CurrentLevel: level}
		}
		query.Q = q
	}

	filters := ports.CRMCustomerQuery{
		Tag:           strings.TrimSpace(cmd.Tag),
		Segment:       strings.ToLower(strings.TrimSpace(cmd.Segment)),
		MinSpendMinor: cmd.MinSpendMinor,
	}
	if filters.Tag != "" || filters.Segment != "" || filters.MinSpendMinor != nil ||
		cmd.LastOrderBefore != "" || cmd.LastOrderAfter != "" {
		if level < LevelFull {
			return ListResult{}, NotEntitledError{Feature: "filters", RequiredLevel: LevelFull, CurrentLevel: level}
		}
	}
	if filters.Segment != "" && filters.Segment != ports.CRMSegmentNew &&
		filters.Segment != ports.CRMSegmentReturning && filters.Segment != ports.CRMSegmentLapsed {
		return ListResult{}, ErrInvalidInput
	}
	if filters.MinSpendMinor != nil && *filters.MinSpendMinor < 0 {
		return ListResult{}, ErrInvalidInput
	}
	before, err := parseListDate(cmd.LastOrderBefore, true)
	if err != nil {
		return ListResult{}, err
	}
	after, err := parseListDate(cmd.LastOrderAfter, false)
	if err != nil {
		return ListResult{}, err
	}
	query.Tag = filters.Tag
	query.Segment = filters.Segment
	query.MinSpendMinor = filters.MinSpendMinor
	query.LastOrderBefore = before
	query.LastOrderAfter = after

	list, err := s.crm.ListCustomers(ctx, cmd.Scope, query)
	if err != nil {
		return ListResult{}, err
	}
	// Blank the above-ladder fields rather than omitting rows: the list itself
	// is a Free capability, only the money figures and labels are not (§15.1).
	for i := range list.Customers {
		if level < LevelStandard {
			list.Customers[i].OrdersCount = 0
			list.Customers[i].TotalSpendMinor = 0
		}
		if level < LevelFull {
			list.Customers[i].Tags = nil
		}
	}
	return ListResult{
		Level:     level,
		Customers: list.Customers,
		Total:     list.Total,
		Limit:     query.Limit,
		Offset:    query.Offset,
	}, nil
}

// CustomerCommand addresses one customer inside the caller's tenant.
type CustomerCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	CustomerID common.ID
}

// ProfileResult echoes the CRM level alongside the §15.1 profile.
type ProfileResult struct {
	Level   int
	Profile ports.CRMCustomerProfile
}

// GetCustomer serves GET /v1/crm/customers/{id} (all plans: contact details
// for the call/WhatsApp buttons, full order history, saved measurements).
// Cross-tenant reads 404 from the repository (§6). Spend totals & order count
// ladder to Starter and notes to Starter, so both are blanked below level 1;
// tags ladder to Growth and are blanked below level 2.
func (s Service) GetCustomer(ctx context.Context, cmd CustomerCommand) (ProfileResult, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelBasic, "customer_profile")
	if err != nil {
		return ProfileResult{}, err
	}
	if cmd.CustomerID.IsZero() {
		return ProfileResult{}, ErrInvalidInput
	}
	level := crmLevel(profile)

	result, err := s.crm.GetCustomerProfile(ctx, cmd.Scope, cmd.CustomerID)
	if err != nil {
		return ProfileResult{}, err
	}
	if level < LevelStandard {
		result.OrdersCount = 0
		result.TotalSpendMinor = 0
		result.Note = ""
		result.NoteUpdatedAt = nil
	}
	if level < LevelFull {
		result.Tags = nil
	}
	return ProfileResult{Level: level, Profile: result}, nil
}

// NoteCommand is the §15.1 Starter note upsert: one note text per
// business-customer (keep it simple — the dashboard edits a single textarea).
type NoteCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	CustomerID common.ID
	Note       string
}

// PutNote serves PUT /v1/crm/customers/{id}/notes (Starter+). 404 when the
// customer has no relationship with THIS store — a store cannot annotate a
// stranger's customer (§6).
func (s Service) PutNote(ctx context.Context, cmd NoteCommand) (ports.CRMCustomerNote, error) {
	if _, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelStandard, "notes"); err != nil {
		return ports.CRMCustomerNote{}, err
	}
	note := strings.TrimSpace(cmd.Note)
	if cmd.CustomerID.IsZero() || note == "" || len(note) > maxNoteLength {
		return ports.CRMCustomerNote{}, ErrInvalidInput
	}
	return s.crm.UpsertNote(ctx, cmd.Scope, cmd.CustomerID, note)
}

// TagsCommand replaces one customer's whole tag set (§15.1 Growth).
type TagsCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	CustomerID common.ID
	Tags       []string
}

// PutTags serves PUT /v1/crm/customers/{id}/tags (Growth+): the body IS the
// new set (replace semantics, so the dashboard never diffs). Tags are trimmed,
// deduped preserving order, and bounded; case is preserved ("VIP" stays "VIP").
func (s Service) PutTags(ctx context.Context, cmd TagsCommand) ([]string, error) {
	if _, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelFull, "tags"); err != nil {
		return nil, err
	}
	if cmd.CustomerID.IsZero() {
		return nil, ErrInvalidInput
	}
	tags, err := normalizeTags(cmd.Tags)
	if err != nil {
		return nil, err
	}
	if err := s.crm.ReplaceTags(ctx, cmd.Scope, cmd.CustomerID, tags); err != nil {
		return nil, err
	}
	return tags, nil
}

func normalizeTags(raw []string) ([]string, error) {
	if len(raw) > maxTags {
		return nil, ErrInvalidInput
	}
	tags := make([]string, 0, len(raw))
	seen := map[string]bool{}
	for _, candidate := range raw {
		tag := strings.TrimSpace(candidate)
		if tag == "" || len(tag) > maxTagLength {
			return nil, ErrInvalidInput
		}
		if seen[tag] {
			continue
		}
		seen[tag] = true
		tags = append(tags, tag)
	}
	return tags, nil
}

// Insights serves GET /v1/crm/customers/insights (§15.1 Growth: "new vs
// returning + last-seen / lapsed view"). The segment math (new = first order
// within 30d, returning = >1 order, lapsed = no order in 90+d) lives in the
// repository, measured from the service clock so tests are deterministic.
func (s Service) Insights(ctx context.Context, cmd CustomerCommand) (ports.CRMInsights, error) {
	if _, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelFull, "insights"); err != nil {
		return ports.CRMInsights{}, err
	}
	return s.crm.Insights(ctx, cmd.Scope, s.clock.Now())
}
