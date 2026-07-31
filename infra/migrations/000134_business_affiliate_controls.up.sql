alter table affiliate_programmes
    add column created_by_business_user_id uuid
        references business_users (business_user_id) on delete set null,
    add column updated_by_business_user_id uuid
        references business_users (business_user_id) on delete set null;

alter table affiliates
    add column created_by_business_user_id uuid
        references business_users (business_user_id) on delete set null,
    add column updated_by_business_user_id uuid
        references business_users (business_user_id) on delete set null;

create policy affiliates_business_isolation on affiliates
    for all
    using (
        owner_business_id =
            nullif(
                current_setting('xtiitch.current_business_id', true),
                ''
            )::uuid
    )
    with check (
        owner_business_id =
            nullif(
                current_setting('xtiitch.current_business_id', true),
                ''
            )::uuid
        and exists (
            select 1
            from affiliate_programmes programme
            where programme.affiliate_programme_id =
                    affiliates.affiliate_programme_id
                and programme.owner_type = 'business'
                and programme.business_id = affiliates.owner_business_id
        )
    );

create policy affiliate_clicks_business_read on affiliate_clicks
    for select
    using (
        exists (
            select 1
            from affiliates affiliate
            where affiliate.affiliate_id = affiliate_clicks.affiliate_id
                and affiliate.owner_business_id =
                    nullif(
                        current_setting(
                            'xtiitch.current_business_id',
                            true
                        ),
                        ''
                    )::uuid
        )
    );

create policy affiliate_signups_business_read on affiliate_signups
    for select
    using (
        exists (
            select 1
            from affiliates affiliate
            where affiliate.affiliate_id = affiliate_signups.affiliate_id
                and affiliate.owner_business_id =
                    nullif(
                        current_setting(
                            'xtiitch.current_business_id',
                            true
                        ),
                        ''
                    )::uuid
        )
    );
