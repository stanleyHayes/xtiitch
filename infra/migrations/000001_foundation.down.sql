DROP POLICY IF EXISTS customer_businesses_tenant_isolation ON customer_businesses;
DROP POLICY IF EXISTS business_users_tenant_isolation ON business_users;
DROP POLICY IF EXISTS store_settings_tenant_isolation ON store_settings;
DROP POLICY IF EXISTS businesses_tenant_isolation ON businesses;

DROP TABLE IF EXISTS customer_businesses;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS business_users;
DROP TABLE IF EXISTS store_settings;
DROP TABLE IF EXISTS businesses;
DROP TABLE IF EXISTS plans;

DROP EXTENSION IF EXISTS pgcrypto;

