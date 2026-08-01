package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// How many owner alerts one settlement will claim. A settlement normally has
// exactly one; the bound exists so a business that accumulated unsent alerts
// (an earlier outage) drains steadily instead of trying to email everything at
// once inside a payment transaction.
const ownerOrderEmailClaimLimit = 20

// claimOwnerOrderEmails takes ownership of the new-order alerts this business
// still owes an email for, and returns everything needed to send them.
//
// The UPDATE is the claim. Stamping owner_email_sent_at inside the settlement
// transaction means a redelivered Paystack webhook — which is normal, not
// exceptional — finds no unclaimed rows and sends nothing. Two concurrent
// settlements cannot both claim the same row either: the second waits on the
// row lock and then fails the `owner_email_sent_at is null` predicate.
//
// The trade this makes: a claimed row whose email then fails to send is not
// retried, because the stamp is already committed. That is deliberate. The
// owner still gets the SMS, which is the immediate channel, and duplicating
// emails on every webhook redelivery would be worse than missing one after an
// email-provider outage.
func claimOwnerOrderEmails(
	ctx context.Context,
	tx pgx.Tx,
	businessID string,
	now time.Time,
) ([]ports.OwnerOrderEmail, error) {
	rows, err := tx.Query(ctx, `
		with claimed as (
			select m.message_id
			from outbound_messages m
			where m.business_id = $1
				and m.kind = $2
				and m.owner_email_sent_at is null
			order by m.created_at asc
			limit $4
			for update skip locked
		)
		update outbound_messages m
		set owner_email_sent_at = $3
		from claimed
		where m.message_id = claimed.message_id
		returning
			m.message_id::text,
			coalesce(m.payload ->> 'order_id', ''),
			coalesce(m.payload ->> 'customer', ''),
			coalesce(m.payload ->> 'design', ''),
			coalesce((m.payload ->> 'amount_minor')::bigint, 0)
	`, businessID, string(notification.KindNewOrderOwner), now, ownerOrderEmailClaimLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var claimed []ports.OwnerOrderEmail
	for rows.Next() {
		var (
			messageID string
			orderID   string
			item      ports.OwnerOrderEmail
		)
		if err := rows.Scan(
			&messageID,
			&orderID,
			&item.CustomerName,
			&item.DesignTitle,
			&item.AmountMinor,
		); err != nil {
			return nil, err
		}
		item.MessageID = common.ID(messageID)
		item.OrderID = common.ID(orderID)
		claimed = append(claimed, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(claimed) == 0 {
		return nil, nil
	}

	// The owner's address is not on the message — the alert was addressed to a
	// phone. One lookup for the business covers every row claimed above.
	owner, err := lookupBusinessOwnerContact(ctx, tx, businessID)
	if err != nil {
		return nil, err
	}
	if owner.email == "" {
		// No address on file: nothing to send, and the rows stay stamped so this
		// does not re-run on every future settlement. The SMS still went out.
		return nil, nil
	}
	for index := range claimed {
		claimed[index].OwnerEmail = owner.email
		claimed[index].OwnerName = owner.displayName
	}
	return claimed, nil
}

type businessOwnerContact struct {
	email       string
	displayName string
}

// lookupBusinessOwnerContact returns the business's owner account. Mirrors the
// LATERAL join the SMS enqueue uses — oldest owner wins — so both channels
// address the same person.
func lookupBusinessOwnerContact(
	ctx context.Context,
	tx pgx.Tx,
	businessID string,
) (businessOwnerContact, error) {
	var contact businessOwnerContact
	err := tx.QueryRow(ctx, `
		select coalesce(email, ''), coalesce(display_name, '')
		from business_users
		where business_id = $1 and role = 'owner'
		order by created_at asc
		limit 1
	`, businessID).Scan(&contact.email, &contact.displayName)
	if err != nil {
		if err == pgx.ErrNoRows {
			return businessOwnerContact{}, nil
		}
		return businessOwnerContact{}, err
	}
	return contact, nil
}
