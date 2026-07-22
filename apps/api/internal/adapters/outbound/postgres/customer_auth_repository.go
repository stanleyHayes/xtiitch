package postgres

import (
	"context"
	"database/sql"
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
			-- §12 / §5.3.3: the store's phone so the customer can call about an
			-- order. There is no businesses.phone — the store's contact is the
			-- owner's number: their direct phone first, their WhatsApp number
			-- (the only contact older owners have) as the fallback.
			coalesce((
				select coalesce(nullif(bu.phone, ''), nullif(bu.whatsapp_number, ''), '')
				from business_users bu
				where bu.business_id = o.business_id and bu.role = 'owner' and bu.is_active
				order by bu.created_at asc
				limit 1
			), ''),
			coalesce(d.title, ''),
			o.status,
			case when o.flow = 'bespoke' then 'bespoke' else 'standard' end,
			o.checkout_group_id::text,
			coalesce(o.agreed_total_minor, 0),
			o.created_at,
			o.received_at
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
		var checkoutGroupID *string
		if err := rows.Scan(
			&o.OrderID,
			&o.BusinessName,
			&o.BusinessHandle,
			&o.StorePhone,
			&o.DesignTitle,
			&o.Status,
			&o.Kind,
			&checkoutGroupID,
			&o.AgreedTotalMinor,
			&o.CreatedAt,
			&o.ReceivedAt,
		); err != nil {
			return nil, err
		}
		if checkoutGroupID != nil && *checkoutGroupID != "" {
			id := common.ID(*checkoutGroupID)
			o.CheckoutGroupID = &id
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

// GetCustomerOrderPaymentContext loads one of the customer's orders with
// everything a re-initiated payment needs (cross-tenant, RLS bypass — the
// customer identity is global). An order that is missing or belongs to another
// customer comes back as ErrNotFound, indistinguishable by design.
//
//nolint:funlen,gocognit,gocyclo // the cart-basket branch mirrors the original charge
func (repo CustomerAuthRepository) GetCustomerOrderPaymentContext(
	ctx context.Context,
	customerID common.ID,
	orderID common.ID,
) (ports.CustomerOrderPaymentContext, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.CustomerOrderPaymentContext{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.CustomerOrderPaymentContext{}, err
	}

	var result ports.CustomerOrderPaymentContext
	var businessID, groupID, lastPurpose, bookingID, lastReference, lastPaymentStatus sql.NullString
	var originalCustomerID string
	var agreedTotal, lastSettleAmount sql.NullInt64
	var settled int64
	err = tx.QueryRow(ctx, `
		select o.business_id::text, o.customer_id::text, o.status,
			o.agreed_total_minor, o.settled_minor,
			coalesce(order_customer.email, ''), o.checkout_group_id::text,
			(select p.purpose from payments p
				where p.order_id = o.order_id
				order by p.created_at desc limit 1),
			(select coalesce(p.settle_amount_minor, p.amount_minor) from payments p
				where p.order_id = o.order_id
				order by p.created_at desc limit 1),
			(select p.booking_id::text from payments p
				where p.order_id = o.order_id and p.booking_id is not null
				order by p.created_at desc limit 1),
			(select p.provider_reference from payments p
				where p.order_id = o.order_id
				order by p.created_at desc limit 1),
			(select p.status from payments p
				where p.order_id = o.order_id
				order by p.created_at desc limit 1)
		from orders o
		join customers order_customer on order_customer.customer_id = o.customer_id
		left join customers signed_in_customer on signed_in_customer.customer_id = $2
		where o.order_id = $1
			and (
				o.customer_id = $2
				or (
					coalesce(order_customer.phone, '') = ''
					and coalesce(signed_in_customer.email, '') <> ''
					and lower(trim(order_customer.email)) = lower(trim(signed_in_customer.email))
				)
			)
	`, orderID.String(), customerID.String()).Scan(
		&businessID, &originalCustomerID, &result.Status,
		&agreedTotal, &settled,
		&result.CustomerEmail, &groupID,
		&lastPurpose, &lastSettleAmount, &bookingID,
		&lastReference, &lastPaymentStatus,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.CustomerOrderPaymentContext{}, ports.ErrNotFound
	}
	if err != nil {
		return ports.CustomerOrderPaymentContext{}, err
	}
	result.OrderID = orderID
	result.BusinessID = common.ID(businessID.String)
	result.LastPaymentReference = lastReference.String
	result.LastPaymentStatus = lastPaymentStatus.String

	// Before bearer-aware checkout creation, an email-only signed-in customer
	// was stored as a fresh anonymous customer because there was no phone to
	// resolve. The guarded email match above recovers those existing drafts; bind
	// the whole draft basket to the verified account so later retries and order
	// history use the real identity. Phone-backed orders never take this path.
	if originalCustomerID != customerID.String() {
		if _, err := tx.Exec(ctx, `
			update orders
			set customer_id = $2, updated_at = now()
			where customer_id = $1
				and status = 'draft'
				and (order_id = $3 or checkout_group_id = nullif($4, '')::uuid)
		`, originalCustomerID, customerID.String(), orderID.String(), groupID.String); err != nil {
			return ports.CustomerOrderPaymentContext{}, err
		}
		if _, err := tx.Exec(ctx, `
			update order_measurements m
			set customer_id = $2, updated_at = now()
			from orders o
			where m.order_id = o.order_id
				and m.business_id = o.business_id
				and m.customer_id = $1
				and o.customer_id = $2
				and o.status = 'draft'
				and (o.order_id = $3 or o.checkout_group_id = nullif($4, '')::uuid)
		`, originalCustomerID, customerID.String(), orderID.String(), groupID.String); err != nil {
			return ports.CustomerOrderPaymentContext{}, err
		}
	}

	if groupID.Valid {
		// A cart basket is paid by ONE combined charge: re-charge the whole
		// group's outstanding with the same per-design commission bases the
		// original charge used (delivery fees excluded — they are never
		// commissioned), anchored on this order.
		result.Purpose = "cart_full"
		if err := tx.QueryRow(ctx, `
			select coalesce(sum(agreed_total_minor), 0)
			from orders
			where checkout_group_id = $1 and business_id = $2 and status = 'draft'
		`, groupID.String, businessID.String).Scan(&result.OutstandingMinor); err != nil {
			return ports.CustomerOrderPaymentContext{}, err
		}
		rows, err := tx.Query(ctx, `
			select agreed_total_minor - delivery_fee_minor
			from orders
			where checkout_group_id = $1 and business_id = $2 and status = 'draft'
			order by created_at, order_id
		`, groupID.String, businessID.String)
		if err != nil {
			return ports.CustomerOrderPaymentContext{}, err
		}
		defer rows.Close()
		for rows.Next() {
			var line int64
			if err := rows.Scan(&line); err != nil {
				return ports.CustomerOrderPaymentContext{}, err
			}
			result.LineAmountsMinor = append(result.LineAmountsMinor, line)
		}
		if err := rows.Err(); err != nil {
			return ports.CustomerOrderPaymentContext{}, err
		}
	} else {
		// A stand-alone bespoke order keeps agreed_total_minor empty (the final
		// price is negotiated later); its outstanding is the deposit the first
		// charge carried, read back from that payment's settle amount.
		if agreedTotal.Valid {
			result.OutstandingMinor = agreedTotal.Int64 - settled
		} else if lastSettleAmount.Valid {
			result.OutstandingMinor = lastSettleAmount.Int64 - settled
		}
		result.Purpose = lastPurpose.String
		if result.Purpose == "" {
			result.Purpose = "standard_full"
		}
		if result.Purpose == "booking_deposit" && bookingID.Valid {
			id := common.ID(bookingID.String)
			result.BookingID = &id
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ports.CustomerOrderPaymentContext{}, err
	}
	return result, nil
}

// MarkCustomerOrderReceived stamps the customer's "Received" acknowledgement
// (§5.3.2) on one of their orders. The read-then-write runs in one transaction
// under the RLS bypass (customer identity is global, orders are tenant-scoped);
// the write is additionally guarded by received_at IS NULL so a concurrent
// repeat can never move the stamp.
func (repo CustomerAuthRepository) MarkCustomerOrderReceived(
	ctx context.Context,
	customerID common.ID,
	orderID common.ID,
	at time.Time,
) (ports.MarkReceivedResult, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return ports.MarkReceivedResult{}, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return ports.MarkReceivedResult{}, err
	}

	var status string
	var receivedAt *time.Time
	err = tx.QueryRow(ctx, `
		select status, received_at from orders
		where order_id = $1 and customer_id = $2
		for update
	`, orderID.String(), customerID.String()).Scan(&status, &receivedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		// Another customer's order is indistinguishable from a missing one.
		return ports.MarkReceivedResult{Found: false}, commitOrErr(ctx, tx)
	}
	if err != nil {
		return ports.MarkReceivedResult{}, err
	}

	result := ports.MarkReceivedResult{Found: true, FinalStage: true}
	if receivedAt != nil {
		result.AlreadyReceived = true
		return result, commitOrErr(ctx, tx)
	}
	// §5.3.2: only an order the store owner moved to its FINAL stage shows the
	// "Received" button — everything earlier is still the store's to finish.
	if status != "fulfilled" {
		result.FinalStage = false
		return result, commitOrErr(ctx, tx)
	}

	if _, err := tx.Exec(ctx, `
		update orders set received_at = $3, updated_at = now()
		where order_id = $1 and customer_id = $2 and received_at is null
	`, orderID.String(), customerID.String(), at); err != nil {
		return ports.MarkReceivedResult{}, err
	}
	return result, tx.Commit(ctx)
}

// MarkCustomerBasketReceived stamps every final-stage, not-yet-acknowledged
// order the customer has in one checkout basket (§5.3.2 whole-basket
// "Received"). Baskets are per-store by construction (a checkout group only
// ever holds one store's orders), so the checkout_group_id alone identifies
// the basket — no business handle is needed. One UPDATE = one transaction;
// the count is the number of rows newly stamped.
func (repo CustomerAuthRepository) MarkCustomerBasketReceived(
	ctx context.Context,
	customerID common.ID,
	checkoutGroupID common.ID,
	at time.Time,
) (int, error) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return 0, err
	}

	tag, err := tx.Exec(ctx, `
		update orders set received_at = $3, updated_at = now()
		where customer_id = $1 and checkout_group_id = $2
			and status = 'fulfilled' and received_at is null
	`, customerID.String(), checkoutGroupID.String(), at)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
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

func (repo CustomerAuthRepository) UpdateCustomerProfile(
	ctx context.Context,
	customerID common.ID,
	displayName,
	email,
	whatsAppPhone string) (ports.CustomerProfile,
	error,
) {
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
	`,
		customerID.String(), displayName, email, whatsAppPhone,
	).Scan(&p.CustomerID, &p.DisplayName, &p.Phone, &p.Email, &p.WhatsAppPhone); err != nil {
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
	`,
		input.ChallengeID.String(), string(channel), nullIfEmpty(input.Phone),
		nullIfEmpty(input.Email), input.CodeHash, input.ExpiresAt,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// LatestActiveOTPChallenge resolves the newest active challenge for a channel +
// identifier. The identifier is matched against the channel's column (phone for
// whatsapp, email for email) so the two channels never collide.
func (repo CustomerAuthRepository) LatestActiveOTPChallenge(
	ctx context.Context,
	channel ports.CustomerOTPChannel,
	identifier string,
	now time.Time) (ports.OTPChallengeRecord,
	error,
) {
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

// commitOrErr closes out a mark-received transaction whose outcome was already
// decided by the guarded reads above (found / already-received / not-final):
// nothing was written, but the repo's convention is to end every transaction
// explicitly rather than relying on the deferred rollback.
func commitOrErr(ctx context.Context, tx pgx.Tx) error {
	return tx.Commit(ctx)
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
