-- Online ordering & checkout is a paid benefit: the storefront only takes
-- online orders when the business's plan grants `online_ordering`. Grant it to
-- the paid tiers; the free tier remains a catalogue/showcase. Admins can re-map
-- it on any plan from the package editor.

update plans
set features = features || '{"online_ordering": true}'::jsonb
where code in ('standard', 'growth');
