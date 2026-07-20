-- 000115_business_addons_policy_nullif
--
-- The business_addons RLS policy (000053) predates the hardened policy form
-- used everywhere else: it casts current_setting('xtiitch.current_business_id')
-- straight to uuid. On pooled API connections that GUC is routinely the empty
-- string (transaction-local set_config leaves '' behind on the session after
-- commit), and ''::uuid raises SQLSTATE 22P02 — even when the bypass arm of the
-- policy is true, because Postgres does not short-circuit OR arms in policy
-- quals. Every other tenant policy guards the cast with NULLIF; this brings
-- business_addons in line. Failure seen in production-shaped testing: deleting
-- a business (or any cross-tenant business_addons read) 500s with
-- "invalid input syntax for type uuid".

drop policy if exists business_addons_tenant on business_addons;

create policy business_addons_tenant on business_addons
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = nullif(current_setting('xtiitch.current_business_id', true), '')::uuid
    );
