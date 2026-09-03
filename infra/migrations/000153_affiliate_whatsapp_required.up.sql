-- Item 6: every new Affiliate signup must persist a canonical international
-- WhatsApp number. NOT VALID preserves legacy rows while enforcing the rule on
-- every new insert and future update.
alter table affiliate_applications
    add constraint affiliate_applications_whatsapp_required_check
    check (phone ~ '^\+[1-9][0-9]{7,14}$') not valid;
