-- Operator invites: an admin is created inactive and without a password, and
-- the person themselves sets the password from a one-time link.
--
-- This replaces "the inviter types a temporary password and reads it out",
-- which put a working credential into a chat message or a phone call and left
-- it valid until someone remembered to change it.
--
-- Mirrors affiliate_activation_tokens (000128) deliberately: only the token's
-- HASH is stored, so a database read cannot mint access; the row carries its
-- own expiry; and consumed_at makes it single-use. The admin_users row exists
-- from the moment of invite with is_active = false, so the operator list can
-- show a pending invite and the email stays reserved.
create table admin_user_invites (
	invite_id uuid primary key default gen_random_uuid(),
	admin_user_id uuid not null
		references admin_users (admin_user_id) on delete cascade,
	token_hash text not null unique,
	-- Where the link was sent. Kept for the audit trail and to re-send without
	-- retyping; the phone is optional because SMS is best-effort.
	sent_to_email text not null,
	sent_to_phone text not null default '',
	invited_by uuid references admin_users (admin_user_id) on delete set null,
	expires_at timestamptz not null,
	consumed_at timestamptz,
	created_at timestamptz not null default now()
);

-- Lookup is always by token hash on the accept path.
create index admin_user_invites_token_idx on admin_user_invites (token_hash);

-- One live invite per operator: re-inviting supersedes rather than accumulates,
-- so a revoked-then-reissued link cannot leave an older link working.
create unique index admin_user_invites_pending_idx
	on admin_user_invites (admin_user_id)
	where consumed_at is null;
