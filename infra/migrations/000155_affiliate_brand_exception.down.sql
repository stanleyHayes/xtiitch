update affiliate_programmes
set name = 'Xtiitch Partner Program',
    description = 'Partners earn recurring commission on eligible Xtiitch subscription payments.',
    updated_at = now()
where owner_type = 'platform'
  and is_default;
