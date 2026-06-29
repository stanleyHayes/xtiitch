-- Heavy demo seed: businesses spanning every plan + billing cycle, each with
-- real logins, subscriptions, catalogue, customers, orders, measurements,
-- design-waitlist entries and payments — enough to exercise every dashboard,
-- storefront, admin and billing feature end to end.
--
-- Safe to run repeatedly: every row is keyed by a deterministic UUID and upserts
-- (md5(...)::uuid derives stable child ids from the parent so re-runs are no-ops).
-- Passwords are bcrypt-hashed with pgcrypto (gen_salt('bf')); the Go API verifies
-- these $2a$ hashes natively. Every seeded login uses the password:
--
--     XtiitchDemo!2026
--
-- Run:  docker exec -i xtiitch-demo-pg psql -U xtiitch -d xtiitch < scripts/seed-demo-full.sql

begin;

-- Belt-and-braces: open the RLS bypass for this seeding transaction so inserts
-- land regardless of whether the connecting role is forced under row-level
-- security. (The owner role normally bypasses RLS anyway.)
select set_config('xtiitch.bypass', 'on', true);

-- ---------------------------------------------------------------------------
-- Curated demo businesses. plan_code + billing_cycle drive plan-gated features
-- and the billing surfaces. brand_color/logo/banner/layout are only honoured by
-- the storefront when the plan actually grants the matching feature.
-- ---------------------------------------------------------------------------
create temporary table tmp_demo on commit drop as
select *
from (
  values
    -- business_id, name, handle, plan_code, billing_cycle, verification, brand_color, logo_url, banner_url, layout_variant
    ('1a1a1a1a-0000-4000-8000-000000000001'::uuid, 'Adwoa Couture',  'adwoa-couture',  'growth',   'yearly',  'verified',
        '#6a1b9a',
        'https://res.cloudinary.com/demo/image/upload/w_240/sample.jpg',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80',
        'spotlight'),
    ('2b2b2b2b-0000-4000-8000-000000000002'::uuid, 'Kente Republic', 'kente-republic', 'growth',   'monthly', 'verified',
        '#1565c0',
        'https://res.cloudinary.com/demo/image/upload/w_240/sample.jpg',
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80',
        'minimal'),
    ('4d4d4d4d-0000-4000-8000-000000000004'::uuid, 'Accra Atelier',  'accra-atelier',  'starter', 'yearly',  'verified',
        '#c2410c', null, null, 'standard'),
    ('3c3c3c3c-0000-4000-8000-000000000003'::uuid, 'Nubian Threads', 'nubian-threads', 'starter', 'monthly', 'verified',
        '#2e7d32', null, null, 'standard')
) as d(business_id, name, handle, plan_code, billing_cycle, verification, brand_color, logo_url, banner_url, layout_variant);

-- Resolve plan_id once for convenience.
alter table tmp_demo add column plan_id uuid;
update tmp_demo d set plan_id = p.plan_id from plans p where p.code = d.plan_code;

-- 1) Businesses ------------------------------------------------------------
insert into businesses (
  business_id, plan_id, name, handle, verification_status,
  settlement_provider, settlement_provider_subaccount, settlement_mobile_money_number,
  default_deposit_minor, operational_status, created_at, updated_at
)
select d.business_id, d.plan_id, d.name, d.handle, d.verification,
       'paystack', 'DEV_SUB_' || d.handle, '0550000000',
       10000, 'active', now(), now()
from tmp_demo d
on conflict (business_id) do update
  set plan_id = excluded.plan_id,
      verification_status = excluded.verification_status,
      operational_status = 'active',
      updated_at = now();

-- 2) Storefront customization (only honoured where the plan grants it). Upsert
--    so it applies even when a store_settings row was never created (e.g. shops
--    seeded by raw SQL rather than the registration flow).
insert into store_settings (business_id, brand_color, logo_url, banner_url, layout_variant)
select d.business_id, d.brand_color, d.logo_url, d.banner_url, d.layout_variant
from tmp_demo d
on conflict (business_id) do update
set brand_color    = excluded.brand_color,
    logo_url       = excluded.logo_url,
    banner_url     = excluded.banner_url,
    layout_variant = excluded.layout_variant,
    updated_at     = now();

-- 3) Logins. Owner for every shop; admin + staff for the two growth flagships.
--    Deterministic ids → re-runs just refresh the password hash.
insert into business_users (business_user_id, business_id, email, display_name, password_hash, role, is_active)
select md5(d.business_id::text || ':owner')::uuid, d.business_id,
       'owner@' || d.handle || '.test', d.name || ' Owner',
       crypt('XtiitchDemo!2026', gen_salt('bf', 12)), 'owner', true
from tmp_demo d
on conflict (business_user_id) do update
  set password_hash = excluded.password_hash, is_active = true, updated_at = now();

insert into business_users (business_user_id, business_id, email, display_name, password_hash, role, is_active)
select md5(d.business_id::text || ':admin')::uuid, d.business_id,
       'admin@' || d.handle || '.test', d.name || ' Admin',
       crypt('XtiitchDemo!2026', gen_salt('bf', 12)), 'admin', true
from tmp_demo d
where d.plan_code = 'growth'
on conflict (business_user_id) do update
  set password_hash = excluded.password_hash, is_active = true, updated_at = now();

insert into business_users (business_user_id, business_id, email, display_name, password_hash, role, is_active)
select md5(d.business_id::text || ':staff')::uuid, d.business_id,
       'staff@' || d.handle || '.test', d.name || ' Staff',
       crypt('XtiitchDemo!2026', gen_salt('bf', 12)), 'staff', true
from tmp_demo d
where d.plan_code = 'growth'
on conflict (business_user_id) do update
  set password_hash = excluded.password_hash, is_active = true, updated_at = now();

-- Reset the historical demo logins to the documented password too, so
-- credentials.txt is accurate for the pre-existing free/standard shops.
update business_users
set password_hash = crypt('XtiitchDemo!2026', gen_salt('bf', 12)), updated_at = now()
where email in (
  'owner@demoatelier.test', 'admin@demoatelier.test', 'staff@demoatelier.test',
  'owner@demo.test'
);

-- 4) Production stages (registration normally seeds these; back-fill the
--    SQL-seeded shops that never had them so orders can reference a stage).
insert into stage_templates (stage_id, business_id, name, colour, flow, sequence, created_at, updated_at)
select md5(d.business_id::text || ':stage:' || s.flow || ':' || s.sequence)::uuid,
       d.business_id, s.name, s.colour, s.flow, s.sequence, now(), now()
from tmp_demo d
cross join (values
  ('Order placed',      'red',    'ready_made', 1),
  ('Preparing',         'yellow', 'ready_made', 2),
  ('Ready / delivered', 'green',  'ready_made', 3),
  ('Order received',    'red',    'bespoke',    1),
  ('Being made',        'yellow', 'bespoke',    2),
  ('Ready for fitting', 'yellow', 'bespoke',    3),
  ('Ready / delivered', 'green',  'bespoke',    4)
) as s(name, colour, flow, sequence)
on conflict (stage_id) do nothing;

-- 5) Default bespoke measurement fields (back-fill, same as registration).
insert into measurement_fields (field_id, business_id, label, unit, sequence, created_at, updated_at)
select md5(d.business_id::text || ':mf:' || m.sequence)::uuid,
       d.business_id, m.label, 'in', m.sequence, now(), now()
from tmp_demo d
cross join (values
  ('Chest / Bust', 1), ('Waist', 2), ('Hips', 3), ('Shoulder', 4),
  ('Sleeve length', 5), ('Top length', 6), ('Trouser length', 7), ('Neck', 8)
) as m(label, sequence)
on conflict (field_id) do nothing;

-- 6) Subscriptions + a paid invoice for the paid plans. Monthly vs yearly is
--    expressed by the period length and the amount (monthly_fee vs yearly_fee).
insert into business_subscriptions (
  subscription_id, business_id, plan_id, status, billing_mode, provider,
  current_period_start, current_period_end, next_billing_at, last_payment_at,
  last_invoice_ref, created_at, updated_at
)
select md5(d.business_id::text || ':sub')::uuid, d.business_id, d.plan_id,
       'active', 'recurring', 'manual',
       now() - interval '5 days',
       case when d.billing_cycle = 'yearly' then now() + interval '360 days'
            else now() + interval '25 days' end,
       case when d.billing_cycle = 'yearly' then now() + interval '360 days'
            else now() + interval '25 days' end,
       now() - interval '5 days',
       'INV-' || upper(d.handle) || '-CURRENT',
       now(), now()
from tmp_demo d
where d.plan_code <> 'free'
on conflict (subscription_id) do update
  set plan_id = excluded.plan_id, status = 'active',
      current_period_end = excluded.current_period_end,
      next_billing_at = excluded.next_billing_at, updated_at = now();

insert into business_subscription_invoices (
  invoice_id, subscription_id, business_id, plan_id, invoice_ref, status,
  billing_mode, provider, amount_minor, currency, period_start, period_end,
  due_at, paid_at, created_at, updated_at
)
select md5(d.business_id::text || ':inv')::uuid,
       md5(d.business_id::text || ':sub')::uuid, d.business_id, d.plan_id,
       'INV-' || upper(d.handle) || '-CURRENT', 'paid', 'recurring', 'manual',
       case when d.billing_cycle = 'yearly' then p.yearly_fee_minor else p.monthly_fee_minor end,
       'GHS', now() - interval '5 days',
       case when d.billing_cycle = 'yearly' then now() + interval '360 days'
            else now() + interval '25 days' end,
       now() - interval '5 days', now() - interval '5 days',
       now(), now()
from tmp_demo d
join plans p on p.plan_id = d.plan_id
where d.plan_code <> 'free'
on conflict (invoice_id) do nothing;

-- 7) Customers (global identities) + per-business links. -------------------
insert into customers (customer_id, email, phone, display_name, created_at, updated_at)
values
  (md5('cust:ama')::uuid,    'ama.mensah@example.com',  '0551000001', 'Ama Mensah',    now(), now()),
  (md5('cust:kojo')::uuid,   'kojo.boateng@example.com','0551000002', 'Kojo Boateng',  now(), now()),
  (md5('cust:efua')::uuid,   'efua.owusu@example.com',  '0551000003', 'Efua Owusu',    now(), now()),
  (md5('cust:yaw')::uuid,    'yaw.darko@example.com',   '0551000004', 'Yaw Darko',     now(), now()),
  (md5('cust:adjoa')::uuid,  'adjoa.asante@example.com','0551000005', 'Adjoa Asante',  now(), now())
on conflict (customer_id) do nothing;

insert into customer_businesses (business_id, customer_id, first_seen_at, created_at, updated_at)
select d.business_id, c.customer_id, now() - interval '20 days', now(), now()
from tmp_demo d
cross join (values
  (md5('cust:ama')::uuid), (md5('cust:kojo')::uuid), (md5('cust:efua')::uuid),
  (md5('cust:yaw')::uuid), (md5('cust:adjoa')::uuid)
) as c(customer_id)
on conflict (business_id, customer_id) do nothing;

-- 7.5) Catalogue: size bands, designs and their band prices. These were
--      previously assumed to come from scripts/seed-demo.sql, but the orders
--      below reference them by id, so the full seed must create them itself to
--      be self-contained (otherwise every order fails its design/band FK and the
--      whole transaction rolls back). Band/design ids match the orders block.
insert into size_bands (size_band_id, business_id, label, chart, sequence, created_at, updated_at) values
  ('1a1a1a1a-0000-4000-8000-0000000000b1','1a1a1a1a-0000-4000-8000-000000000001','Standard fit','{}',1, now(), now()),
  ('2b2b2b2b-0000-4000-8000-0000000000b2','2b2b2b2b-0000-4000-8000-000000000002','Standard fit','{}',1, now(), now()),
  ('3c3c3c3c-0000-4000-8000-0000000000b3','3c3c3c3c-0000-4000-8000-000000000003','Standard fit','{}',1, now(), now()),
  ('4d4d4d4d-0000-4000-8000-0000000000b4','4d4d4d4d-0000-4000-8000-000000000004','Standard fit','{}',1, now(), now())
on conflict (size_band_id) do nothing;

insert into designs (design_id, business_id, collection_id, title, description, images, customisation_allowed, handle, status, sequence, created_at, updated_at) values
  ('1a1a1a1a-0000-4000-8000-0000000000d1','1a1a1a1a-0000-4000-8000-000000000001',null,'Royal Purple Kaftan','Flowing kaftan in deep purple with gold-thread trim.',ARRAY['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80']::text[],true,'royal-purple-kaftan','active',1, now(), now()),
  ('1a1a1a1a-0000-4000-8000-0000000000d2','1a1a1a1a-0000-4000-8000-000000000001',null,'Beaded Ankara Gown','Floor-length Ankara gown with hand-beaded bodice.',ARRAY['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80']::text[],true,'beaded-ankara-gown','active',2, now(), now()),
  ('1a1a1a1a-0000-4000-8000-0000000000d3','1a1a1a1a-0000-4000-8000-000000000001',null,'Adinkra Shirt Dress','Relaxed shirt dress printed with Adinkra symbols.',ARRAY['https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80']::text[],true,'adinkra-shirt-dress','active',3, now(), now()),
  ('2b2b2b2b-0000-4000-8000-0000000000d4','2b2b2b2b-0000-4000-8000-000000000002',null,'Kente Power Blazer','Sharp tailored blazer with a kente-trim lapel.',ARRAY['https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80']::text[],true,'kente-power-blazer','active',1, now(), now()),
  ('2b2b2b2b-0000-4000-8000-0000000000d5','2b2b2b2b-0000-4000-8000-000000000002',null,'Slim Kente Trousers','Slim-cut trousers with a woven kente side stripe.',ARRAY['https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1000&q=80']::text[],false,'slim-kente-trousers','active',2, now(), now()),
  ('2b2b2b2b-0000-4000-8000-0000000000d6','2b2b2b2b-0000-4000-8000-000000000002',null,'Festival Kente Set','Two-piece festival set in bold royal kente.',ARRAY['https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1000&q=80']::text[],true,'festival-kente-set','active',3, now(), now()),
  ('3c3c3c3c-0000-4000-8000-0000000000d7','3c3c3c3c-0000-4000-8000-000000000003',null,'Emerald Boubou','Grand boubou in emerald with tonal embroidery.',ARRAY['https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1000&q=80']::text[],true,'emerald-boubou','active',1, now(), now()),
  ('3c3c3c3c-0000-4000-8000-0000000000d8','3c3c3c3c-0000-4000-8000-000000000003',null,'Mudcloth Jacket','Structured jacket in hand-stamped mudcloth.',ARRAY['https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1000&q=80']::text[],true,'mudcloth-jacket','active',2, now(), now()),
  ('3c3c3c3c-0000-4000-8000-0000000000d9','3c3c3c3c-0000-4000-8000-000000000003',null,'Green Lace Kaba','Kaba and slit in soft green guipure lace.',ARRAY['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80']::text[],true,'green-lace-kaba','active',3, now(), now()),
  ('4d4d4d4d-0000-4000-8000-0000000000da','4d4d4d4d-0000-4000-8000-000000000004',null,'Terracotta Agbada','Three-piece agbada in warm terracotta.',ARRAY['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80']::text[],true,'terracotta-agbada','active',1, now(), now()),
  ('4d4d4d4d-0000-4000-8000-0000000000db','4d4d4d4d-0000-4000-8000-000000000004',null,'Sunset Wrap Skirt','Bias-cut wrap skirt in a sunset ombré.',ARRAY['https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80']::text[],false,'sunset-wrap-skirt','active',2, now(), now()),
  ('4d4d4d4d-0000-4000-8000-0000000000dc','4d4d4d4d-0000-4000-8000-000000000004',null,'Coastal Linen Shirt','Breezy unisex linen shirt for the coast.',ARRAY['https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80']::text[],false,'coastal-linen-shirt','active',3, now(), now())
on conflict (design_id) do nothing;

insert into design_prices (design_id, size_band_id, business_id, price_minor, created_at, updated_at) values
  ('1a1a1a1a-0000-4000-8000-0000000000d1','1a1a1a1a-0000-4000-8000-0000000000b1','1a1a1a1a-0000-4000-8000-000000000001',52000, now(), now()),
  ('1a1a1a1a-0000-4000-8000-0000000000d2','1a1a1a1a-0000-4000-8000-0000000000b1','1a1a1a1a-0000-4000-8000-000000000001',68000, now(), now()),
  ('1a1a1a1a-0000-4000-8000-0000000000d3','1a1a1a1a-0000-4000-8000-0000000000b1','1a1a1a1a-0000-4000-8000-000000000001',41000, now(), now()),
  ('2b2b2b2b-0000-4000-8000-0000000000d4','2b2b2b2b-0000-4000-8000-0000000000b2','2b2b2b2b-0000-4000-8000-000000000002',75000, now(), now()),
  ('2b2b2b2b-0000-4000-8000-0000000000d5','2b2b2b2b-0000-4000-8000-0000000000b2','2b2b2b2b-0000-4000-8000-000000000002',38000, now(), now()),
  ('2b2b2b2b-0000-4000-8000-0000000000d6','2b2b2b2b-0000-4000-8000-0000000000b2','2b2b2b2b-0000-4000-8000-000000000002',90000, now(), now()),
  ('3c3c3c3c-0000-4000-8000-0000000000d7','3c3c3c3c-0000-4000-8000-0000000000b3','3c3c3c3c-0000-4000-8000-000000000003',60000, now(), now()),
  ('3c3c3c3c-0000-4000-8000-0000000000d8','3c3c3c3c-0000-4000-8000-0000000000b3','3c3c3c3c-0000-4000-8000-000000000003',55000, now(), now()),
  ('3c3c3c3c-0000-4000-8000-0000000000d9','3c3c3c3c-0000-4000-8000-0000000000b3','3c3c3c3c-0000-4000-8000-000000000003',48000, now(), now()),
  ('4d4d4d4d-0000-4000-8000-0000000000da','4d4d4d4d-0000-4000-8000-0000000000b4','4d4d4d4d-0000-4000-8000-000000000004',85000, now(), now()),
  ('4d4d4d4d-0000-4000-8000-0000000000db','4d4d4d4d-0000-4000-8000-0000000000b4','4d4d4d4d-0000-4000-8000-000000000004',33000, now(), now()),
  ('4d4d4d4d-0000-4000-8000-0000000000dc','4d4d4d4d-0000-4000-8000-0000000000b4','4d4d4d4d-0000-4000-8000-000000000004',29000, now(), now())
on conflict do nothing;

-- 8) Orders across statuses + flows, each pinned to a real stage. ----------
--    Design ids and size-band ids are seeded in section 7.5 above.
insert into orders (
  order_id, business_id, customer_id, design_id, size_band_id,
  order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status,
  current_stage_id, created_at, updated_at
)
select
  md5(o.business_id::text || ':order:' || o.seq)::uuid,
  o.business_id, o.customer_id, o.design_id, o.size_band_id,
  o.order_type, o.size_mode, o.flow, o.channel, o.agreed_total_minor, o.settled_minor, o.status,
  (
    select s.stage_id from stage_templates s
    where s.business_id = o.business_id and s.flow = o.flow
    order by case when o.status = 'fulfilled' then -s.sequence else s.sequence end
    limit 1
  ),
  now() - (o.age_days || ' days')::interval, now()
from (
  values
    -- business_id, seq, customer_id, design_id, size_band_id, order_type, size_mode, flow, channel, agreed_total, settled, status, age_days
    ('1a1a1a1a-0000-4000-8000-000000000001'::uuid, 1, md5('cust:ama')::uuid,   '1a1a1a1a-0000-4000-8000-0000000000d1'::uuid, '1a1a1a1a-0000-4000-8000-0000000000b1'::uuid, 'standard', 'band',         'ready_made', 'online',  52000, 52000, 'fulfilled',        18),
    ('1a1a1a1a-0000-4000-8000-000000000001'::uuid, 2, md5('cust:kojo')::uuid,  '1a1a1a1a-0000-4000-8000-0000000000d2'::uuid, null,                                         'custom',   'self_measure', 'bespoke',    'online',  68000, 20000, 'confirmed',        6),
    ('1a1a1a1a-0000-4000-8000-000000000001'::uuid, 3, md5('cust:efua')::uuid,  '1a1a1a1a-0000-4000-8000-0000000000d3'::uuid, null,                                         'custom',   'come_to_shop', 'bespoke',    'walk_in', 41000, 0,     'awaiting_deposit', 2),
    ('2b2b2b2b-0000-4000-8000-000000000002'::uuid, 1, md5('cust:yaw')::uuid,   '2b2b2b2b-0000-4000-8000-0000000000d4'::uuid, '2b2b2b2b-0000-4000-8000-0000000000b2'::uuid, 'standard', 'band',         'ready_made', 'online',  75000, 75000, 'fulfilled',        14),
    ('2b2b2b2b-0000-4000-8000-000000000002'::uuid, 2, md5('cust:adjoa')::uuid, '2b2b2b2b-0000-4000-8000-0000000000d6'::uuid, null,                                         'custom',   'self_measure', 'bespoke',    'online',  90000, 30000, 'confirmed',        4),
    ('4d4d4d4d-0000-4000-8000-000000000004'::uuid, 1, md5('cust:ama')::uuid,   '4d4d4d4d-0000-4000-8000-0000000000da'::uuid, '4d4d4d4d-0000-4000-8000-0000000000b4'::uuid, 'standard', 'band',         'ready_made', 'online',  85000, 85000, 'fulfilled',        12),
    ('4d4d4d4d-0000-4000-8000-000000000004'::uuid, 2, md5('cust:kojo')::uuid,  '4d4d4d4d-0000-4000-8000-0000000000db'::uuid, null,                                         'custom',   'home_visit',   'bespoke',    'online',  33000, 10000, 'confirmed',        3),
    ('3c3c3c3c-0000-4000-8000-000000000003'::uuid, 1, md5('cust:efua')::uuid,  '3c3c3c3c-0000-4000-8000-0000000000d7'::uuid, '3c3c3c3c-0000-4000-8000-0000000000b3'::uuid, 'standard', 'band',         'ready_made', 'online',  60000, 60000, 'fulfilled',        10),
    ('3c3c3c3c-0000-4000-8000-000000000003'::uuid, 2, md5('cust:adjoa')::uuid, '3c3c3c3c-0000-4000-8000-0000000000d9'::uuid, null,                                         'custom',   'self_measure', 'bespoke',    'online',  48000, 15000, 'confirmed',        5)
) as o(business_id, seq, customer_id, design_id, size_band_id, order_type, size_mode, flow, channel, agreed_total_minor, settled_minor, status, age_days)
on conflict (order_id) do nothing;

-- 9) Self-measure submissions for the bespoke self_measure orders. ---------
insert into order_measurements (measurement_id, business_id, order_id, customer_id, source, values, created_at, updated_at)
select md5(o.order_id::text || ':measure')::uuid, o.business_id, o.order_id, o.customer_id, 'self',
       '{"Chest / Bust": 38, "Waist": 32, "Hips": 40, "Shoulder": 16, "Sleeve length": 24}'::jsonb,
       now(), now()
from orders o
where o.size_mode = 'self_measure'
  and o.business_id in (select business_id from tmp_demo)
on conflict (measurement_id) do nothing;

-- 10) Payments tied to the settled orders (through-platform, succeeded). ---
insert into payments (payment_id, business_id, order_id, purpose, amount_minor, currency, method, provider_reference, status, through_platform, commission_minor, created_at, updated_at)
select md5(o.order_id::text || ':payment')::uuid, o.business_id, o.order_id,
       case when o.order_type = 'standard' then 'standard_full' else 'deposit' end,
       o.settled_minor, 'GHS', 'card', 'DEMO_PSK_' || left(replace(o.order_id::text, '-', ''), 12),
       'succeeded', true, (o.settled_minor * 5 / 100), now(), now()
from orders o
where o.settled_minor > 0
  and o.business_id in (select business_id from tmp_demo)
on conflict (payment_id) do nothing;

-- 11) Design-waitlist entries for the growth shops (design_waitlist feature).
insert into design_waitlist_entries (entry_id, business_id, design_id, customer_name, customer_contact, note, status, created_at, updated_at)
values
  (md5('wait:adwoa:1')::uuid, '1a1a1a1a-0000-4000-8000-000000000001'::uuid, '1a1a1a1a-0000-4000-8000-0000000000d1'::uuid, 'Akosua Frimpong', '0552000001', 'Wants the kaftan in royal blue for a wedding.', 'waiting', now(), now()),
  (md5('wait:adwoa:2')::uuid, '1a1a1a1a-0000-4000-8000-000000000001'::uuid, '1a1a1a1a-0000-4000-8000-0000000000d2'::uuid, 'Nana Yaa',        '0552000002', 'Asked to be told when the beaded gown restocks.', 'waiting', now(), now()),
  (md5('wait:kente:1')::uuid, '2b2b2b2b-0000-4000-8000-000000000002'::uuid, '2b2b2b2b-0000-4000-8000-0000000000d4'::uuid, 'Kwame Osei',      '0552000003', 'Power blazer in size L please.',                  'waiting', now(), now())
on conflict (entry_id) do nothing;

commit;

-- Summary readout (handy when running by hand).
select b.handle, p.code as plan,
       (select count(*) from business_users u where u.business_id = b.business_id) as users,
       (select count(*) from orders o where o.business_id = b.business_id)         as orders,
       (select count(*) from design_waitlist_entries w where w.business_id = b.business_id) as waitlist
from businesses b
join plans p on p.plan_id = b.plan_id
where b.handle in ('adwoa-couture', 'kente-republic', 'accra-atelier', 'nubian-threads', 'demoatelier')
order by p.monthly_fee_minor, b.handle;
