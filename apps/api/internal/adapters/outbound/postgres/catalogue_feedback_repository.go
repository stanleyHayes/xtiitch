package postgres

import (
	"context"
	"encoding/json"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func (repo CatalogueRepository) CreateFeedbackReport(ctx context.Context, input ports.FeedbackReportInput) error {
	contextPayload := input.Context
	if len(contextPayload) == 0 || !json.Valid(contextPayload) {
		contextPayload = json.RawMessage(`{}`)
	}
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackCatalogueUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
			insert into feedback_reports (
				feedback_report_id, business_id, reporter_type, surface, kind,
				priority, subject, message, page_url, user_agent, contact, context, stack
			)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
		`,
		input.ReportID.String(),
		nullableIDArg(input.BusinessID),
		input.ReporterType,
		input.Surface,
		input.Kind,
		input.Priority,
		input.Subject,
		input.Message,
		input.PageURL,
		input.UserAgent,
		input.Contact,
		string(contextPayload),
		input.Stack,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
