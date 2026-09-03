-- Release every outstanding hold back to the status it carried beforehand so no
-- commission row is stranded in a status the restored constraint rejects.
update affiliate_conversions
set status = coalesce(pre_hold_status, 'pending'),
    hold_released_at = now(),
    updated_at = now()
where status = 'held';

drop index if exists affiliate_conversions_held_idx;

alter table affiliate_conversions
    drop constraint if exists affiliate_conversions_hold_state_check,
    drop constraint if exists affiliate_conversions_status_check;

alter table affiliate_conversions
    drop column if exists hold_reason,
    drop column if exists pre_hold_status,
    drop column if exists hold_placed_at,
    drop column if exists hold_released_at,
    drop column if exists held_by_admin_user_id,
    drop column if exists hold_released_by_admin_user_id;

alter table affiliate_conversions
    add constraint affiliate_conversions_status_check
    check (status in ('pending', 'approved', 'settled', 'reversed'));
