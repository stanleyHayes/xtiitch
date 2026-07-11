package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// CustomerAuthRepository persists phone OTP challenges and resolves customer
// identities. Customers are a global identity, so it runs under the RLS bypass.
type CustomerAuthRepository struct {
	pool *pgxpool.Pool
}

func NewCustomerAuthRepository(pool *pgxpool.Pool) CustomerAuthRepository {
	return CustomerAuthRepository{pool: pool}
}

// ListCustomerOrders returns a customer's orders across every shop they've
// bought from (cross-tenant, RLS bypass), newest first.
func (repo CustomerAuthRepository) ListCustomerOrders(ctx context.Context, customerID common.ID) ([]ports.CustomerOrderSummary, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select
			o.order_id,
			b.name,
			b.handle,
			coalesce(d.title, ''),
			o.status,
			coalesce(o.agreed_total_minor, 0),
			o.created_at
		from orders o
		join businesses b on b.business_id = o.business_id
		left join designs d on d.design_id = o.design_id
		where o.customer_id = $1
		order by o.created_at desc
		limit 100
	`, customerID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]ports.CustomerOrderSummary, 0)
	for rows.Next() {
		var o ports.CustomerOrderSummary
		if err := rows.Scan(
			&o.OrderID,
			&o.BusinessName,
			&o.BusinessHandle,
			&o.DesignTitle,
			&o.Status,
			&o.AgreedTotalMinor,
			&o.CreatedAt,
		); err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return orders, nil
}

func (repo CustomerAuthRepository) GetCustomerProfile(ctx context.Context, customerID common.ID) (ports.CustomerProfile, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.CustomerProfile{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.CustomerProfile{}, err
	}

	var p ports.CustomerProfile
	if err := tx.QueryRow(ctx, `
		select customer_id, coalesce(display_name, ''), coalesce(phone, ''), coalesce(email, ''), coalesce(whatsapp_phone, '')
		from customers
		where customer_id = $1 and erased_at is null
	`, customerID.String()).Scan(&p.CustomerID, &p.DisplayName, &p.Phone, &p.Email, &p.WhatsAppPhone); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.CustomerProfile{}, ErrNotFound
		}
		return ports.CustomerProfile{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.CustomerProfile{}, err
	}
	return p, nil
}

func (repo CustomerAuthRepository) UpdateCustomerProfile(ctx context.Context, customerID common.ID, displayName, email, whatsAppPhone string) (ports.CustomerProfile, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.CustomerProfile{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.CustomerProfile{}, err
	}

	var p ports.CustomerProfile
	if err := tx.QueryRow(ctx, `
		update customers
		set display_name = $2, email = $3, whatsapp_phone = $4
		where customer_id = $1 and erased_at is null
		returning customer_id, coalesce(display_name, ''), coalesce(phone, ''), coalesce(email, ''), coalesce(whatsapp_phone, '')
	`, customerID.String(), displayName, email, whatsAppPhone).Scan(&p.CustomerID, &p.DisplayName, &p.Phone, &p.Email, &p.WhatsAppPhone); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.CustomerProfile{}, ErrNotFound
		}
		return ports.CustomerProfile{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ports.CustomerProfile{}, err
	}
	return p, nil
}

func (repo CustomerAuthRepository) CreateOTPChallenge(ctx context.Context, input ports.CreateOTPChallengeInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	channel := input.Channel
	if channel == "" {
		channel = ports.CustomerOTPChannelWhatsApp
	}
	if _, err := tx.Exec(ctx, `
		insert into customer_otp_challenges (challenge_id, channel, phone, email, code_hash, expires_at)
		values ($1, $2, $3, $4, $5, $6)
	`, input.ChallengeID.String(), string(channel), nullIfEmpty(input.Phone), nullIfEmpty(input.Email), input.CodeHash, input.ExpiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// LatestActiveOTPChallenge resolves the newest active challenge for a channel +
// identifier. The identifier is matched against the channel's column (phone for
// whatsapp, email for email) so the two channels never collide.
func (repo CustomerAuthRepository) LatestActiveOTPChallenge(ctx context.Context, channel ports.CustomerOTPChannel, identifier string, now time.Time) (ports.OTPChallengeRecord, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.OTPChallengeRecord{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.OTPChallengeRecord{}, err
	}

	identifierColumn := "phone"
	if channel == ports.CustomerOTPChannelEmail {
		identifierColumn = "email"
	}

	var record ports.OTPChallengeRecord
	var channelText string
	if err := tx.QueryRow(ctx, `
		select challenge_id::text, channel, coalesce(phone, ''), coalesce(email, ''), code_hash, attempts, expires_at
		from customer_otp_challenges
		where channel = $1 and `+identifierColumn+` = $2 and consumed_at is null and expires_at > $3
		order by created_at desc
		limit 1
	`, string(channel), identifier, now).Scan(
		&record.ChallengeID, &channelText, &record.Phone, &record.Email, &record.CodeHash, &record.Attempts, &record.ExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ports.OTPChallengeRecord{}, ports.ErrNotFound
		}
		return ports.OTPChallengeRecord{}, err
	}
	record.Channel = ports.CustomerOTPChannel(channelText)
	if err := tx.Commit(ctx); err != nil {
		return ports.OTPChallengeRecord{}, err
	}
	return record, nil
}

func (repo CustomerAuthRepository) IncrementOTPAttempts(ctx context.Context, challengeID common.ID) error {
	return repo.execBypass(ctx, `
		update customer_otp_challenges set attempts = attempts + 1 where challenge_id = $1
	`, challengeID.String())
}

func (repo CustomerAuthRepository) ConsumeOTPChallenge(ctx context.Context, challengeID common.ID) error {
	return repo.execBypass(ctx, `
		update customer_otp_challenges set consumed_at = now() where challenge_id = $1
	`, challengeID.String())
}

func (repo CustomerAuthRepository) UpsertVerifiedCustomerByPhone(ctx context.Context, newID common.ID, phone string) (common.ID, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return common.ID(""), err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return common.ID(""), err
	}

	var existing string
	err = tx.QueryRow(ctx, `
		select customer_id::text from customers
		where phone = $1 and erased_at is null
		order by created_at desc
		limit 1
	`, phone).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return common.ID(""), err
	}

	if existing != "" {
		if _, err := tx.Exec(ctx, `
			update customers set phone_verified_at = now(), updated_at = now() where customer_id = $1
		`, existing); err != nil {
			return common.ID(""), err
		}
		if err := tx.Commit(ctx); err != nil {
			return common.ID(""), err
		}
		return common.ID(existing), nil
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, phone, phone_verified_at)
		values ($1, $2, now())
	`, newID.String(), phone); err != nil {
		return common.ID(""), err
	}
	if err := tx.Commit(ctx); err != nil {
		return common.ID(""), err
	}
	return newID, nil
}

// UpsertVerifiedCustomerByEmail resolves the customer for a verified email,
// matched case-insensitively (earliest match wins), or creates one with that
// email and no phone. Mirrors UpsertVerifiedCustomerByPhone.
func (repo CustomerAuthRepository) UpsertVerifiedCustomerByEmail(ctx context.Context, newID common.ID, email string) (common.ID, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return common.ID(""), err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return common.ID(""), err
	}

	var existing string
	err = tx.QueryRow(ctx, `
		select customer_id::text from customers
		where lower(email) = lower($1) and erased_at is null
		order by created_at asc
		limit 1
	`, email).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return common.ID(""), err
	}

	if existing != "" {
		if _, err := tx.Exec(ctx, `
			update customers set updated_at = now() where customer_id = $1
		`, existing); err != nil {
			return common.ID(""), err
		}
		if err := tx.Commit(ctx); err != nil {
			return common.ID(""), err
		}
		return common.ID(existing), nil
	}

	if _, err := tx.Exec(ctx, `
		insert into customers (customer_id, email)
		values ($1, $2)
	`, newID.String(), email); err != nil {
		return common.ID(""), err
	}
	if err := tx.Commit(ctx); err != nil {
		return common.ID(""), err
	}
	return newID, nil
}

// nullIfEmpty maps an empty string to a SQL NULL so the unused identifier column
// (phone for an email challenge, or vice versa) stays null rather than blank.
func nullIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func (repo CustomerAuthRepository) execBypass(ctx context.Context, sql string, args ...any) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, sql, args...); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
