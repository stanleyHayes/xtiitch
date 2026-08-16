update affiliate_applications
set status = 'pending_review', affiliate_id = null, reviewed_at = null,
    review_note = '', metadata = metadata - 'approval_mode' - 'migration',
    updated_at = now()
where metadata ->> 'migration' = '000145';

delete from affiliates
where source_application_id in (
    select affiliate_application_id
    from affiliate_applications
    where review_note = '' and status = 'pending_review'
)
and notes = 'Legacy application enrolled by migration 000145.';
