-- AI search is a metered customer benefit: free shoppers get a monthly allowance,
-- pro shoppers are unlimited. ai_search_pro is the entitlement flag (granted on a
-- paid customer subscription; manual for now). Usage is counted per subject — a
-- signed-in customer, or a salted, non-reversible hash of an anonymous client —
-- per calendar month. The table holds no PII (anonymous subjects are hashed) and
-- is platform-global metering, so it carries no row-level security.

alter table customers add column ai_search_pro boolean not null default false;

create table ai_search_usage (
    subject_kind text not null,            -- 'customer' | 'anon'
    subject_id   text not null,            -- customer_id, or salted hash of client
    period_month date not null,            -- first day of the usage month (UTC)
    search_count integer not null default 0,
    updated_at   timestamptz not null default now(),
    primary key (subject_kind, subject_id, period_month)
);

grant select, insert, update, delete on ai_search_usage to xtiitch_app;
