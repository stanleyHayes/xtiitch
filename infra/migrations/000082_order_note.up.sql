-- Customer note captured at checkout (special instructions on a design/order).
-- The storefront has always collected this and sent it; the API previously
-- rejected the field (DisallowUnknownFields), so any order carrying a note failed.
alter table orders
    add column note text not null default '';
