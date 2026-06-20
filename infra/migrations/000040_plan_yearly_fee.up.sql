alter table plans
    add column if not exists yearly_fee_minor integer not null default 0
        check (yearly_fee_minor >= 0);

update plans
set yearly_fee_minor = monthly_fee_minor * 12
where yearly_fee_minor = 0
  and monthly_fee_minor > 0;
