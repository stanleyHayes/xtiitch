-- Annual billing now gives two months free (yearly = 10 × the monthly fee),
-- so paying yearly is a clear saving rather than 12× the monthly price.

update plans set yearly_fee_minor = monthly_fee_minor * 10
where code in ('standard', 'growth')
  and monthly_fee_minor > 0;
