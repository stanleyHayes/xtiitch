-- Marketing nav gate for the affiliate programme, matching the existing
-- marketing_show_* launch flags (000056). The affiliate portal can be live and
-- usable while the public "become an affiliate" entry point stays hidden, so
-- the programme can be opened to the public on its own schedule rather than
-- whenever the code happens to ship.
--
-- Default false, like every other launch flag: a feature is hidden until an
-- operator deliberately turns it on.
alter table admin_platform_settings
	add column if not exists marketing_show_affiliate_signup boolean not null default false;
