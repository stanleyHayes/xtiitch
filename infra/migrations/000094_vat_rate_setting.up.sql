-- §4.1: the VAT rate becomes an admin-editable platform setting, effective
-- immediately across ALL payments (subscriptions — where it applies to the
-- package price — and store sales — where it applies to the Xtiitch fee). The
-- default is Ghana's standard 20% (2000 bps). Until now the rate came only from
-- the XTIITCH_SUBSCRIPTION_VAT_RATE_BPS env var (default 0 / disabled), which
-- becomes merely the seed/fallback: the live value is read from this column at
-- charge time, so an admin change needs no redeploy. 0 disables VAT.
alter table admin_platform_settings
    add column if not exists vat_rate_bps integer not null default 2000
        check (vat_rate_bps between 0 and 10000);
