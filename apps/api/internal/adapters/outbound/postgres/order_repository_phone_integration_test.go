package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Integration coverage for the §5.3.4 canonical-phone choke point against a
// real, migrated database, opt-in via XTIITCH_TEST_DATABASE_URL like the other
// integration suites. Proves the guest-checkout forms (024…, bare 9-digit,
// +233 with separators) and the OTP-login form (233…) resolve ONE customer
// identity — the bug that split one person into two rows.
//
// The test phone (0247766110 / 233247766110) is deliberately unlike the demo
// data so the resolve-or-create assertions start from "no such customer".

const (
	itPhoneCustA = "12121212-0000-0000-0000-0000000000a1"
	itPhoneCustB = "12121212-0000-0000-0000-0000000000b1"
	itPhoneCustC = "12121212-0000-0000-0000-0000000000c1"
	itPhoneCustD = "12121212-0000-0000-0000-0000000000d1"
)

func TestResolveOrCreateCustomerByPhoneCanonicalizesEveryAcceptedForm(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	repo := NewOrderRepository(pool)
	ctx := context.Background()

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from customers where customer_id = any($1)`,
			[]string{itPhoneCustA, itPhoneCustB, itPhoneCustC, itPhoneCustD})
	})

	// First guest checkout with the local 024… form mints the identity.
	id, created, err := repo.ResolveOrCreateCustomerByPhone(ctx, "0247766110", common.ID(itPhoneCustA))
	if err != nil {
		t.Fatalf("resolve local form: %v", err)
	}
	if !created || id != common.ID(itPhoneCustA) {
		t.Fatalf("expected a fresh customer %q, got id=%q created=%v", itPhoneCustA, id, created)
	}

	// …and stores it canonically, matching what the OTP login path writes.
	var stored string
	inBypass(t, pool, func(tx pgx.Tx) {
		if err := tx.QueryRow(ctx, `select phone from customers where customer_id = $1`, itPhoneCustA).Scan(&stored); err != nil {
			t.Fatalf("read stored phone: %v", err)
		}
	})
	if stored != "233247766110" {
		t.Fatalf("expected canonical stored phone 233247766110, got %q", stored)
	}

	// Every other accepted form — including the OTP-login 233… form — resolves
	// the SAME row; none of them mints the offered new id.
	for _, form := range []string{"233247766110", "+233 24 776 6110", "247766110", "024-776-6110"} {
		id, created, err = repo.ResolveOrCreateCustomerByPhone(ctx, form, common.ID(itPhoneCustB))
		if err != nil {
			t.Fatalf("resolve %q: %v", form, err)
		}
		if created || id != common.ID(itPhoneCustA) {
			t.Fatalf("form %q: expected existing customer %q, got id=%q created=%v", form, itPhoneCustA, id, created)
		}
	}

	// The by-phone lookup sees the same row through any form too.
	foundID, found, err := repo.FindCustomerIDByPhone(ctx, "024 776 6110")
	if err != nil {
		t.Fatalf("find by phone: %v", err)
	}
	if !found || foundID != common.ID(itPhoneCustA) {
		t.Fatalf("expected lookup to find %q, got id=%q found=%v", itPhoneCustA, foundID, found)
	}
}

func TestResolveOrCreateCustomerByPhoneRejectsInvalidPhone(t *testing.T) {
	pool := openIntegrationPool(t)
	defer pool.Close()
	repo := NewOrderRepository(pool)
	ctx := context.Background()

	inBypass(t, pool, func(tx pgx.Tx) {
		mustExec(t, tx, `delete from customers where customer_id = any($1)`,
			[]string{itPhoneCustA, itPhoneCustB, itPhoneCustC, itPhoneCustD})
	})

	// An unnormalizable number is an error and stores nothing.
	if _, _, err := repo.ResolveOrCreateCustomerByPhone(ctx, "not-a-phone", common.ID(itPhoneCustC)); !errors.Is(err, common.ErrInvalidPhone) {
		t.Fatalf("expected common.ErrInvalidPhone, got %v", err)
	}
	if n := countBypass(t, pool, `select count(*) from customers where customer_id = $1`, itPhoneCustC); n != 0 {
		t.Fatalf("invalid phone must not create a customer row, found %d", n)
	}

	// No phone at all stays an anonymous identity (no row, no error) — the
	// pre-existing phone-less checkout behaviour is unchanged.
	id, created, err := repo.ResolveOrCreateCustomerByPhone(ctx, "   ", common.ID(itPhoneCustD))
	if err != nil {
		t.Fatalf("blank phone: %v", err)
	}
	if !created || id != common.ID(itPhoneCustD) {
		t.Fatalf("expected anonymous fresh id %q, got id=%q created=%v", itPhoneCustD, id, created)
	}
	if n := countBypass(t, pool, `select count(*) from customers where customer_id = $1`, itPhoneCustD); n != 0 {
		t.Fatalf("blank phone must not insert a customer row, found %d", n)
	}
}
