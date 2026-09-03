-- Item 6: rewards are not fixed. Admin configures what a milestone pays out —
-- a bonus, money, a gift, merchandise, recognition, access, or another
-- approved benefit — and, where the reward is monetary, how much it is worth.
alter table partner_milestones
    add column if not exists reward_type text not null default 'recognition',
    add column if not exists reward_value_minor bigint;

alter table partner_milestones
    drop constraint if exists partner_milestones_reward_type_check;

alter table partner_milestones
    add constraint partner_milestones_reward_type_check
    check (reward_type in (
        'cash', 'bonus', 'gift', 'merchandise', 'recognition', 'access', 'other'
    ));

-- A monetary reward without an amount is not a configured reward, and a
-- non-monetary one has no amount to carry.
alter table partner_milestones
    drop constraint if exists partner_milestones_reward_value_check;

alter table partner_milestones
    add constraint partner_milestones_reward_value_check
    check (
        case
            when reward_type in ('cash', 'bonus')
                then reward_value_minor is not null and reward_value_minor > 0
            else reward_value_minor is null
        end
    );
