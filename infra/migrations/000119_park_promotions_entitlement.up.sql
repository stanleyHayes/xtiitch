-- 000119_park_promotions_entitlement
--
-- Product update: the Promotions feature is PARKED for every plan. No plan may
-- see or access it while parked; it returns later. This is a clean park, not a
-- deletion of the concept — the promotions tables, HTTP endpoints, service and
-- the FeaturePromotions constant/enforcement all stay in place; with no plan
-- entitled, enforcement naturally rejects everyone.
--
-- 1. Remove the feature from the admin entitlement matrix. Deleting the
--    plan_entitlement_features row cascades to plan_entitlement_values (FK
--    ON DELETE CASCADE, 000067), so every per-plan promotions grant goes with
--    it. The runtime projection (mirrorAdminPlanEntitlementsSQL) only mirrors
--    value rows, so a later matrix save cannot resurrect the grant.
delete from plan_entitlement_features
where feature_key = 'promotions';

-- 2. Un-project the boolean key from the runtime read path (plans.features),
--    mirroring what the matrix mirror would write on its next save. With the
--    key also gone from the code FeatureCatalogue, SanitizeFeatures drops it
--    for any blob written before this migration ran.
update plans p
set features = coalesce(p.features, '{}'::jsonb) - 'promotions',
    updated_at = now()
where p.features ? 'promotions';
