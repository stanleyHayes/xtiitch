# Tenant Isolation

Tenant isolation is the primary security invariant for Xtiitch.

## Rules

- A tenant is a business.
- Every tenant-scoped table must include `business_id`.
- Every tenant-scoped repository method must require a server-derived tenant scope.
- Every tenant-scoped SQL query must filter by `business_id`.
- Public storefront access must resolve scope from the store handle.
- Direct-reference access outside scope returns not found.
- Cache keys, job payloads, and notification payloads must carry tenant scope when they reference tenant data.
- PostgreSQL Row Level Security should be enabled for tenant-scoped tables after the migration baseline exists.

## Testing

Every critical feature must include at least one deliberate cross-tenant access attempt in tests.

