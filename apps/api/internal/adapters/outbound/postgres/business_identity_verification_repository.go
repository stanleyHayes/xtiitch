package postgres

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// SubmitIdentityDocument upserts a business's Ghana Card number + ID photo and
// moves it into verification 'pending' for operator review. Tenant-scoped (the
// document table is RLS-isolated). An already-verified business keeps its status
// so a resubmission never silently de-verifies a live store.
func (repo BusinessIdentityRepository) SubmitIdentityDocument(ctx context.Context, input ports.SubmitIdentityDocumentInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)

	if _, err := tx.Exec(ctx, `select set_config('xtiitch.current_business_id', $1, true)`, input.BusinessID.String()); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into business_identity_documents (business_id, full_legal_name, card_number, id_photo_url, id_photo_back_url, submitted_at)
		values ($1, $2, $3, $4, $5, now())
		on conflict (business_id) do update
		set full_legal_name = excluded.full_legal_name,
			card_number = excluded.card_number,
			id_photo_url = excluded.id_photo_url,
			id_photo_back_url = excluded.id_photo_back_url,
			submitted_at = now(),
			updated_at = now()
	`, input.BusinessID.String(), input.FullLegalName, input.CardNumber, input.IDPhotoURL, input.IDPhotoBackURL); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		update businesses
		set verification_status = case
				when verification_status = 'verified' then verification_status
				else 'pending'
			end,
			updated_at = now()
		where business_id = $1
	`, input.BusinessID.String()); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
