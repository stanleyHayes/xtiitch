-- Revert annual pricing to a flat 12× the monthly fee.
update plans set yearly_fee_minor = monthly_fee_minor * 12
where code in ('standard', 'growth')
  and monthly_fee_minor > 0;
