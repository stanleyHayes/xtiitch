-- User-approved exception to the v1.4/v1.5 Partner rebrand: the launched
-- customer identity remains Affiliate and the portal remains affiliate.xtiitch.com.
update affiliate_programmes
set name = 'Xtiitch Affiliate Programme',
    description = 'Affiliates earn recurring commission on eligible Xtiitch subscription payments.',
    updated_at = now()
where owner_type = 'platform'
  and is_default;
