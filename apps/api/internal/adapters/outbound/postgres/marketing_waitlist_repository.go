package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// MarketingWaitlistRepository persists leads captured from the public marketing
// site. waitlist_leads is platform-level (not tenant-scoped), so — like
// admin_platform_settings — it carries no row-level security and the queries run
// directly on the pool with no tenant scope.
type MarketingWaitlistRepository struct {
	pool *pgxpool.Pool
}

func NewMarketingWaitlistRepository(pool *pgxpool.Pool) MarketingWaitlistRepository {
	return MarketingWaitlistRepository{pool: pool}
}

func (repo MarketingWaitlistRepository) CreateWaitlistLead(
	ctx context.Context,
	input ports.CreateWaitlistLeadInput,
) (ports.WaitlistLeadRecord, error) {
	return scanWaitlistLeadRecord(repo.pool.QueryRow(ctx, `
		insert into waitlist_leads (
			id, name, business, phone, email, city, message, source, user_agent
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		returning
			id, name, business, phone, email, city, message, source, user_agent, created_at
	`,
		input.LeadID.String(),
		input.Name,
		input.Business,
		input.Phone,
		input.Email,
		input.City,
		input.Message,
		input.Source,
		input.UserAgent,
	))
}

func (repo MarketingWaitlistRepository) ListWaitlistLeads(
	ctx context.Context,
	limit int,
) ([]ports.WaitlistLeadRecord, error) {
	rows, err := repo.pool.Query(ctx, `
		select
			id, name, business, phone, email, city, message, source, user_agent, created_at
		from waitlist_leads
		order by created_at desc
		limit $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	leads := make([]ports.WaitlistLeadRecord, 0)
	for rows.Next() {
		lead, err := scanWaitlistLeadRecord(rows)
		if err != nil {
			return nil, err
		}
		leads = append(leads, lead)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return leads, nil
}

func scanWaitlistLeadRecord(row pgx.Row) (ports.WaitlistLeadRecord, error) {
	var record ports.WaitlistLeadRecord
	if err := row.Scan(
		&record.LeadID,
		&record.Name,
		&record.Business,
		&record.Phone,
		&record.Email,
		&record.City,
		&record.Message,
		&record.Source,
		&record.UserAgent,
		&record.CreatedAt,
	); err != nil {
		return ports.WaitlistLeadRecord{}, err
	}

	return record, nil
}
