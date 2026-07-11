package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// EmbeddingRepository stores design embeddings and serves the candidate set for
// marketplace semantic search. Ingest + search are platform-wide, so both run
// under the RLS bypass.
type EmbeddingRepository struct {
	pool *pgxpool.Pool
}

func NewEmbeddingRepository(pool *pgxpool.Pool) EmbeddingRepository {
	return EmbeddingRepository{pool: pool}
}

func (repo EmbeddingRepository) DesignsNeedingEmbedding(
	ctx context.Context,
	limit int,
	model string) ([]ports.DesignEmbeddingSource,
	error,
) {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		with sources as (
			select d.design_id, d.business_id,
				trim(both ' ' from
					coalesce(d.title, '') || ' ' ||
					coalesce(d.description, '') || ' ' ||
					coalesce(c.name, '') || ' ' ||
					coalesce(b.name, '')
				) as content
			from designs d
			join businesses b on b.business_id = d.business_id
			left join collections c on c.collection_id = d.collection_id
			where d.status = 'active'
		)
		select s.design_id::text, s.business_id::text, s.content, md5(s.content)
		from sources s
		left join design_embeddings de on de.design_id = s.design_id
		where de.content_hash is null
			or de.content_hash <> md5(s.content)
			or de.model <> $2
		limit $1
	`, limit, model)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ports.DesignEmbeddingSource
	for rows.Next() {
		var src ports.DesignEmbeddingSource
		if err := rows.Scan(&src.DesignID, &src.BusinessID, &src.Content, &src.ContentHash); err != nil {
			return nil, err
		}
		out = append(out, src)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func (repo EmbeddingRepository) UpsertEmbedding(ctx context.Context, input ports.UpsertEmbeddingInput) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackUnlessCommitted(ctx, tx)
	if err := setTenantBypass(ctx, tx); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		insert into design_embeddings (design_id, business_id, content_hash, embedding, model)
		values ($1, $2, $3, $4, $5)
		on conflict (design_id) do update
		set content_hash = excluded.content_hash,
			embedding = excluded.embedding,
			model = excluded.model,
			updated_at = now()
	`, input.DesignID.String(), input.BusinessID.String(), input.ContentHash, input.Embedding, input.Model); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (repo EmbeddingRepository) SearchCandidates(ctx context.Context) ([]ports.EmbeddingCandidate, error) {
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
			de.design_id::text,
			d.title,
			d.handle,
			coalesce((d.images)[1], ''),
			coalesce(min(dp.price_minor), 0),
			b.name,
			b.handle,
			lower(coalesce(d.title, '') || ' ' || coalesce(d.description, '') || ' ' || coalesce(c.name, '')),
			de.embedding
		from design_embeddings de
		join designs d on d.design_id = de.design_id and d.status = 'active'
		join businesses b on b.business_id = de.business_id
		join plans p on p.plan_id = b.plan_id
		left join collections c on c.collection_id = d.collection_id
		left join design_prices dp on dp.design_id = d.design_id
		where b.verification_status = 'verified'
			and b.operational_status = 'active'
			and coalesce((p.features->>'online_ordering')::boolean, false) = true
		group by de.design_id, d.title, d.handle, d.images, b.name, b.handle, c.name, d.description, de.embedding
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ports.EmbeddingCandidate
	for rows.Next() {
		var c ports.EmbeddingCandidate
		if err := rows.Scan(
			&c.DesignID, &c.DesignTitle, &c.DesignHandle, &c.Image,
			&c.PriceMinor, &c.StoreName, &c.StoreHandle, &c.Searchable, &c.Embedding,
		); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}
