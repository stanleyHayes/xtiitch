alter table affiliate_clicks
    drop constraint affiliate_clicks_affiliate_id_fkey,
    add constraint affiliate_clicks_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;

alter table affiliate_conversions
    drop constraint affiliate_conversions_affiliate_id_fkey,
    add constraint affiliate_conversions_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;

alter table affiliate_attribution_reservations
    drop constraint affiliate_attribution_reservations_affiliate_id_fkey,
    add constraint affiliate_attribution_reservations_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;

alter table affiliate_payout_batches
    drop constraint affiliate_payout_batches_affiliate_id_fkey,
    add constraint affiliate_payout_batches_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;

alter table affiliate_signups
    drop constraint affiliate_signups_affiliate_id_fkey,
    add constraint affiliate_signups_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;

alter table affiliate_plan_attribution_reservations
    drop constraint affiliate_plan_attribution_reservations_affiliate_id_fkey,
    add constraint affiliate_plan_attribution_reservations_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;

alter table affiliate_risk_events
    drop constraint affiliate_risk_events_affiliate_id_fkey,
    add constraint affiliate_risk_events_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;

alter table affiliate_portal_audit_events
    drop constraint affiliate_portal_audit_events_affiliate_id_fkey,
    add constraint affiliate_portal_audit_events_affiliate_id_fkey
        foreign key (affiliate_id) references affiliates (affiliate_id)
        on delete cascade;
