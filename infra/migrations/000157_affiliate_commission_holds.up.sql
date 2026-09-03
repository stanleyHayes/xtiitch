-- Item 4: Company Admin can place an individual suspicious commission on Hold
-- and release it later. A held commission keeps its full financial history: the
-- status it held before the hold is preserved so releasing restores it exactly.
alter table affiliate_conversions
    drop constraint if exists affiliate_conversions_status_check;

alter table affiliate_conversions
    add column if not exists hold_reason text not null default '',
    add column if not exists pre_hold_status text,
    add column if not exists hold_placed_at timestamptz,
    add column if not exists hold_released_at timestamptz,
    add column if not exists held_by_admin_user_id uuid
        references admin_users (admin_user_id) on delete set null,
    add column if not exists hold_released_by_admin_user_id uuid
        references admin_users (admin_user_id) on delete set null;

alter table affiliate_conversions
    add constraint affiliate_conversions_status_check
    check (status in ('pending', 'approved', 'settled', 'reversed', 'held'));

alter table affiliate_conversions
    add constraint affiliate_conversions_hold_state_check
    check (
        status <> 'held'
        or (pre_hold_status in ('pending', 'approved') and hold_placed_at is not null)
    );

create index if not exists affiliate_conversions_held_idx
    on affiliate_conversions (affiliate_id, updated_at desc)
    where status = 'held';
