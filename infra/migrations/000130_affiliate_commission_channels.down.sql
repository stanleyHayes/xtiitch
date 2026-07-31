alter table affiliates
    drop column if exists first_paid_plan_commission_bps,
    drop column if exists purchase_commission_bps;
