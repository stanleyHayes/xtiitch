alter table partner_milestones
    drop constraint if exists partner_milestones_reward_value_check,
    drop constraint if exists partner_milestones_reward_type_check;

alter table partner_milestones
    drop column if exists reward_type,
    drop column if exists reward_value_minor;
