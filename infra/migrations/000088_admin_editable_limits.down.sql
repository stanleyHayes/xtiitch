delete from plan_entitlement_values
where feature_key in ('images_per_design', 'variations_per_design');

delete from plan_entitlement_features
where feature_key in ('images_per_design', 'variations_per_design');

alter table plan_entitlement_features drop column if exists enforced;

alter table plans drop column if exists staff_limit;
alter table plans drop column if exists variation_limit;
alter table plans drop column if exists image_limit;
