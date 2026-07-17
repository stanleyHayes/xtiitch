-- "There is no monthly billing — billed quarterly or yearly only" (Pricing Book
-- rule 1, §2 "No monthly billing option.", checklist #1). The monthly rate is a
-- display unit and the basis for calculating the cadence figures; it is never
-- itself charged.
--
-- billing_cadence was added (000068) as `not null default 'monthly'`, and the
-- recurring sweep's helpers defaulted an unrecognised cadence to "bill the
-- monthly fee, advance one month". So any subscription still carrying the
-- default was billed GHS 49/99/199 monthly -- the one billing model the book
-- rules out. billing_mode='recurring' has existed since 000021, forty-seven
-- migrations before cadence did, so a pre-000068 recurring row needed no admin
-- action to be billed this way: it simply came out of 000068 with cadence
-- 'monthly' and next_billing_at already set.
--
-- 'monthly' always meant "no cadence chosen yet", never "wants monthly": nothing
-- in the code ever set it: it is purely the column default, and the owner-facing
-- validator (normalizeBillingCadence) has always REJECTED 'monthly' as input. A
-- subscription is created at signup, long before the owner picks a cadence at
-- billing onboarding, and that gap is what the default was papering over.
--
-- So the honest model is NULL = "not chosen yet", with the column constrained to
-- the two cadences the book allows. A recurring row that reaches this with no
-- cadence is skipped by the sweep rather than billed at a figure nobody chose:
-- we cannot know whether they wanted quarterly or yearly, and guessing would
-- either bill a price they never agreed to or silently move them to one.
alter table business_subscriptions
    alter column billing_cadence drop default;

alter table business_subscriptions
    alter column billing_cadence drop not null;

alter table business_subscriptions
    drop constraint if exists business_subscriptions_billing_cadence_check;

-- DML on a FORCE-RLS tenant table by the migration role needs the bypass; the
-- ALTERs above are DDL and do not (the rule this repo states at 000068:60-71).
select set_config('xtiitch.bypass', 'on', false);

update business_subscriptions
set billing_cadence = null, updated_at = now()
where billing_cadence = 'monthly';

select set_config('xtiitch.bypass', 'off', false);

alter table business_subscriptions
    add constraint business_subscriptions_billing_cadence_check
    check (billing_cadence is null or billing_cadence in ('quarterly', 'yearly'));
