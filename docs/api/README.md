# API Contracts

REST is the v1 client contract and must be documented with OpenAPI. ADR 0003 confirms that GraphQL is not required for v1 launch; it can be added later as a read-only composed read-model layer if a specific screen needs it.

Current REST notes:

- [Auth API](auth.md)

Planned contract folders:

- `packages/contracts/openapi`
- `packages/contracts/graphql` (parked until a post-v1 read-model need is accepted)
- `packages/contracts/proto`
