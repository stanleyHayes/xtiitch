-- Ghana Card verification now collects BOTH sides of the card. Add a back-photo
-- URL alongside the existing front (id_photo_url). Nullable so the pre-existing
-- single-photo submissions stay valid; new submissions send both sides.
ALTER TABLE business_identity_documents
  ADD COLUMN IF NOT EXISTS id_photo_back_url text;
