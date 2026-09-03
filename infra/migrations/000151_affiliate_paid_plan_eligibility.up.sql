-- Only positive-value invoices for paid plans create affiliate commission.
create or replace function record_partner_subscription_commission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    attribution record;
    settings record;
begin
    if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid')
        or new.amount_minor <= 0
        or not exists (
            select 1 from plans
            where plan_id = new.plan_id and monthly_fee_minor > 0
        )
    then
        return new;
    end if;
    select * into settings from partner_programme_settings where settings_id;
    if now() < settings.recurring_effective_at or settings.commission_bps <= 0 then return new; end if;
    select signup.affiliate_id, signup.affiliate_click_id, affiliate.affiliate_programme_id
    into attribution
    from affiliate_signups signup
    join affiliates affiliate on affiliate.affiliate_id = signup.affiliate_id
    join affiliate_programmes programme on programme.affiliate_programme_id = affiliate.affiliate_programme_id
    where signup.subject_type = 'business' and signup.business_id = new.business_id
      and signup.status = 'qualified' and affiliate.status = 'active'
      and affiliate.owner_business_id is null and programme.owner_type = 'platform'
      and programme.status = 'active'
    order by signup.qualified_at
    limit 1;
    if attribution.affiliate_id is null then return new; end if;
    insert into affiliate_conversions (
        affiliate_conversion_id, affiliate_id, affiliate_click_id, affiliate_programme_id,
        programme_owner_type, funding_source, business_id, conversion_type, subscription_id,
        subscription_invoice_id, payment_reference, gross_minor, commission_minor,
        commission_model, commission_rate, attribution_model, status, hold_until, metadata
    ) values (
        gen_random_uuid(), attribution.affiliate_id, attribution.affiliate_click_id,
        attribution.affiliate_programme_id, 'platform', 'platform', new.business_id,
        'subscription_payment', new.subscription_id, new.invoice_id,
        coalesce(nullif(new.provider_invoice_ref, ''), new.invoice_ref), new.amount_minor,
        least(new.amount_minor, (new.amount_minor * settings.commission_bps::bigint) / 10000),
        'percentage', settings.commission_bps, 'last_click', 'pending',
        now() + make_interval(days => settings.maturity_days),
        jsonb_build_object('source', 'paid_subscription_invoice')
    ) on conflict (payment_reference) where conversion_type = 'subscription_payment' do nothing;
    return new;
end;
$$;
