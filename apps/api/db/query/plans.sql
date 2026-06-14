-- name: ListActivePlans :many
SELECT
  plan_id,
  code,
  name,
  monthly_fee_minor,
  commission_bps,
  design_limit,
  is_active,
  created_at,
  updated_at
FROM plans
WHERE is_active = true
ORDER BY monthly_fee_minor ASC, code ASC;

