-- Restores the original (pre-NULLIF) business_addons policy from 000053.

drop policy if exists business_addons_tenant on business_addons;

create policy business_addons_tenant on business_addons
    using (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = current_setting('xtiitch.current_business_id', true)::uuid
    )
    with check (
        current_setting('xtiitch.bypass', true) = 'on'
        or business_id = current_setting('xtiitch.current_business_id', true)::uuid
    );
