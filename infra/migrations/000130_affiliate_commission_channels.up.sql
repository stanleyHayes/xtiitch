alter table affiliates
    add column purchase_commission_bps integer not null default 0
        check (purchase_commission_bps between 0 and 10000),
    add column first_paid_plan_commission_bps integer not null default 0
        check (first_paid_plan_commission_bps between 0 and 10000);

update affiliates
set purchase_commission_bps = commission_rate::integer
where commission_model = 'percentage';
