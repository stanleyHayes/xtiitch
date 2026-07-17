alter table business_subscriptions
    drop constraint if exists business_subscriptions_billing_cadence_check;

select set_config('xtiitch.bypass', 'on', false);

update business_subscriptions
set billing_cadence = 'monthly', updated_at = now()
where billing_cadence is null;

select set_config('xtiitch.bypass', 'off', false);

alter table business_subscriptions
    alter column billing_cadence set default 'monthly';

alter table business_subscriptions
    alter column billing_cadence set not null;

alter table business_subscriptions
    add constraint business_subscriptions_billing_cadence_check
    check (billing_cadence in ('monthly', 'quarterly', 'yearly'));
