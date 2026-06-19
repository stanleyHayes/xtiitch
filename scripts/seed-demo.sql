begin;

-- 4 verified, active studios so the public directory, storefronts and discovery
-- pages show real shops. Idempotent via PK conflicts.
insert into businesses (business_id, plan_id, name, handle, verification_status, settlement_provider, settlement_provider_subaccount, settlement_mobile_money_number, default_deposit_minor, operational_status, created_at, updated_at) values
  ('1a1a1a1a-0000-4000-8000-000000000001','3620e850-1fe5-44aa-8693-cd7171823e93','Adwoa Couture','adwoa-couture','verified','paystack','DEV_SUB_adwoa','0550000001',10000,'active', now(), now()),
  ('2b2b2b2b-0000-4000-8000-000000000002','3620e850-1fe5-44aa-8693-cd7171823e93','Kente Republic','kente-republic','verified','paystack','DEV_SUB_kente','0550000002',10000,'active', now(), now()),
  ('3c3c3c3c-0000-4000-8000-000000000003','23c95316-630f-4d86-9862-6f43af5ce05a','Nubian Threads','nubian-threads','verified','paystack','DEV_SUB_nubian','0550000003',10000,'active', now(), now()),
  ('4d4d4d4d-0000-4000-8000-000000000004','3620e850-1fe5-44aa-8693-cd7171823e93','Accra Atelier','accra-atelier','verified','paystack','DEV_SUB_accra','0550000004',10000,'active', now(), now())
on conflict (business_id) do nothing;

insert into store_settings (business_id, bespoke_enabled, measurements_enabled, customisation_enabled, collections_enabled, delivery_enabled, dispatch_enabled, brand_color, business_timezone, created_at, updated_at) values
  ('1a1a1a1a-0000-4000-8000-000000000001', true, true, true, true, true, false, '#6a1b9a','Africa/Accra', now(), now()),
  ('2b2b2b2b-0000-4000-8000-000000000002', true, true, true, true, true, false, '#1565c0','Africa/Accra', now(), now()),
  ('3c3c3c3c-0000-4000-8000-000000000003', true, true, true, false, false, false, '#2e7d32','Africa/Accra', now(), now()),
  ('4d4d4d4d-0000-4000-8000-000000000004', true, true, true, true, true, false, '#c2410c','Africa/Accra', now(), now())
on conflict (business_id) do nothing;

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

commit;
