-- §2.3: business verification now collects the owner's FULL LEGAL NAME exactly
-- as it appears on the Ghana Card, alongside the card number and the front/back
-- photos, so the admin reviewer can match the submission against the card.
-- Nullable so the pre-existing submissions stay valid (they review without it);
-- NEW submissions must supply it -- enforced at the service layer
-- (authapp.SubmitIdentityVerification), not by a NOT NULL constraint, so the
-- existing pending/verified rows keep working.
ALTER TABLE business_identity_documents
  ADD COLUMN IF NOT EXISTS full_legal_name text;
