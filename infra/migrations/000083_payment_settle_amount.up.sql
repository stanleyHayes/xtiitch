-- The amount of a payment that counts toward its ORDER's balance (settled_minor),
-- distinct from amount_minor (what the customer was charged). They differ only when
-- the merchant passes the platform fee to the buyer: amount_minor then includes the
-- buyer-borne fee, which must NOT inflate the order's settlement (it routes to the
-- platform, not the merchant). NULL on legacy rows falls back to amount_minor.
alter table payments
    add column settle_amount_minor bigint;
