-- Internal scheduler system actor (§13.3 sweeps, §14.1 scheduled reports,
-- §3.3 settlement sync).
--
-- The worker triggers the platform sweeps over the /v1/internal/* endpoints
-- (authenticated by XTIITCH_INTERNAL_TOKEN, not admin credentials). Those
-- endpoints call the SAME service methods the admin console endpoints call,
-- and those methods require an actor that (a) is non-zero, (b) carries a role
-- with the manage_subscriptions / manage_money_rails permissions, and (c)
-- exists in admin_users — the audit insert joins admin_users for the actor
-- email, and the billing/event tables reference it by foreign key. This seeds
-- that actor: a LOCKED, non-login admin identity every internal sweep is
-- attributed to, so a scheduler run is distinguishable from an operator action
-- in the audit trail instead of impersonating a human admin.
--
-- Login is impossible: is_active = false refuses authentication before any
-- password check, and the password hash is not a bcrypt hash at all, so no
-- credential can ever match it. The row grants no session, token, or API
-- credential — it only satisfies the audit/permission joins.

insert into admin_users (
    admin_user_id,
    email,
    display_name,
    password_hash,
    role,
    is_active
)
values (
    '00000000-0000-0000-0000-000000000001',
    'system@xtiitch.internal',
    'Xtiitch System (scheduler)',
    '!locked-not-a-bcrypt-hash',
    'owner',
    false
)
on conflict (admin_user_id) do nothing;
