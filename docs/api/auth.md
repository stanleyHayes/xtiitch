# Auth API

Business auth starts with owner registration and login. Customer auth will be added separately.

## Register Business Owner

`POST /v1/auth/business/register`

Request:

```json
{
  "business_name": "Ama Stitch House",
  "business_handle": "ama-stitch",
  "owner_display_name": "Ama",
  "owner_email": "ama@example.com",
  "owner_password": "strong-password"
}
```

Behavior:

- Normalizes `business_handle` and `owner_email`.
- Creates the business on the Free plan.
- Creates default store settings.
- Creates the owner business user.
- Hashes the owner password with bcrypt.
- Issues a short-lived access JWT.
- Generates a refresh token and stores only its hash.

Response:

```json
{
  "business_id": "uuid",
  "business_user_id": "uuid",
  "access_token": "jwt",
  "refresh_token": "opaque-secret",
  "access_expires_at": "2026-06-14T20:15:00Z",
  "refresh_expires_at": "2026-07-14T20:00:00Z"
}
```

## Login Business Owner/User

`POST /v1/auth/business/login`

Request:

```json
{
  "business_handle": "ama-stitch",
  "owner_email": "ama@example.com",
  "owner_password": "strong-password"
}
```

Response shape matches registration.

## Errors

```json
{
  "error": "invalid_credentials"
}
```

Common error codes:

- `invalid_request`
- `invalid_input`
- `invalid_credentials`
- `internal_error`

Do not expose whether a business handle, email, or password caused a login failure.

## Security Notes

- Access JWTs include `sub`, `business_id`, `role`, `iss`, `aud`, `iat`, `exp`, and `typ`.
- Refresh tokens are random opaque values; only SHA-256 hashes are persisted.
- Registration and login are auth-boundary operations. Tenant-scoped business operations after login must derive scope from the JWT, not from a client-supplied `business_id`.

