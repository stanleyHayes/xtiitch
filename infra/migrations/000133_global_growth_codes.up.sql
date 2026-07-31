create table growth_codes (
    code text primary key,
    code_type text not null
        check (
            code_type in (
                'affiliate',
                'promotion',
                'referral',
                'subscription_discount'
            )
        ),
    source_id uuid not null,
    created_at timestamptz not null default now(),
    check (code = upper(code)),
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$'),
    unique (code_type, source_id)
);

insert into growth_codes (code, code_type, source_id)
select upper(code), 'affiliate', affiliate_id from affiliates
union all
select upper(code), 'promotion', promotion_id from promotions where code is not null
union all
select upper(code), 'referral', referral_code_id from referral_codes
union all
select upper(code), 'subscription_discount', discount_code_id
from subscription_discount_codes;

create function sync_growth_code_registry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    previous_code text;
    next_code text;
    source_kind text := tg_argv[0];
    source_key uuid;
begin
    if tg_op <> 'INSERT' then
        previous_code := nullif(upper(old.code), '');
        source_key := (to_jsonb(old) ->> tg_argv[1])::uuid;
    end if;

    if tg_op = 'DELETE' then
        delete from growth_codes
        where code = previous_code
            and code_type = source_kind
            and source_id = source_key;
        return old;
    end if;

    next_code := nullif(upper(new.code), '');
    source_key := (to_jsonb(new) ->> tg_argv[1])::uuid;

    if previous_code is not null and previous_code is distinct from next_code then
        delete from growth_codes
        where code = previous_code
            and code_type = source_kind
            and source_id = source_key;
    end if;

    if next_code is not null then
        insert into growth_codes (code, code_type, source_id)
        values (next_code, source_kind, source_key)
        on conflict (code) do update
        set code = excluded.code
        where growth_codes.code_type = excluded.code_type
            and growth_codes.source_id = excluded.source_id;

        if not found then
            raise exception 'growth code % is already in use', next_code
                using errcode = '23505',
                    constraint = 'growth_codes_pkey';
        end if;
    end if;
    return new;
end;
$$;

create trigger affiliates_growth_code_registry
after insert or update of code or delete on affiliates
for each row execute function sync_growth_code_registry(
    'affiliate',
    'affiliate_id'
);

create trigger promotions_growth_code_registry
after insert or update of code or delete on promotions
for each row execute function sync_growth_code_registry(
    'promotion',
    'promotion_id'
);

create trigger referral_codes_growth_code_registry
after insert or update of code or delete on referral_codes
for each row execute function sync_growth_code_registry(
    'referral',
    'referral_code_id'
);

create trigger subscription_discounts_growth_code_registry
after insert or update of code or delete on subscription_discount_codes
for each row execute function sync_growth_code_registry(
    'subscription_discount',
    'discount_code_id'
);

alter table growth_codes enable row level security;
alter table growth_codes force row level security;

create policy growth_codes_admin_bypass on growth_codes
    using (current_setting('xtiitch.bypass', true) = 'on')
    with check (current_setting('xtiitch.bypass', true) = 'on');

grant select on growth_codes to xtiitch_app;
