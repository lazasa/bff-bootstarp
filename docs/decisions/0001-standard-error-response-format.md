# 1. Standard error response format

Date: 2026-05-11

## Status

Accepted

## Context

Every endpoint needs a single, predictable error shape so:

- Frontend callers have one error parser to maintain.
- UIs can branch on `error.code` to show the right copy without parsing
  free-text messages.
- Observability tooling can filter and alert on a structured, stable code.

Without one, a validation failure, a 404, and an upstream error look
different to the caller.

The BFF is **consumer-facing** — messages are read by frontend code and
end users. The error `message` field must be short and intent-only; it must
never contain upstream internals, database identifiers, service names, stack
traces, or constraint names. Those details belong in logs.

## Decision

All errors are returned in the following envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "status": 404,
    "details": [{ "field": "email", "issue": "is required" }]
  }
}
```

- **`code`** — stable, `SCREAMING_SNAKE_CASE` identifier. Callers branch on
  this; never the message.
- **`message`** — consumer-facing, intent-only. Short and actionable.
  ✅ `"User not found"`, `"Email already in use"`, `"Sign in required"`.
  ❌ `"identity-service returned 500 from /v1/users/lookup"`,
  `"redis timeout after 3 retries"`, `"PGRST116 no rows"`.
- **`status`** — mirrors the HTTP status code.
- **`details`** — optional array of `{ field, issue }` pairs for validation
  errors. Field and issue text is consumer-facing — same rule applies.

Implementation lives in `src/plugins/errorHandler.ts`:

- Throw any `AppError` subclass from anywhere; the global handler formats it.
- AJV validation errors are mapped to `VALIDATION_ERROR` 400 with a
  `details` array built from the AJV output.
- System errors (ECONNREFUSED, ETIMEDOUT) map to `SERVICE_UNAVAILABLE` /
  `GATEWAY_TIMEOUT`.
- Unknown errors collapse to `INTERNAL_SERVER_ERROR` 500 (message hidden in
  production).
- 404s caught by `setNotFoundHandler` are emitted as `NOT_FOUND`.

The `ErrorResponseSchema` (in `src/utils/errors.ts`) is registered with
`fastify.addSchema()` in the `errorHandler` plugin and appears in the
OpenAPI `components/schemas` section. All route `response` docs reference it
via `commonErrorResponses` (`src/common/docs/commonResponses.ts`).

### AppError subclass catalogue

| Class | Code | Status |
|---|---|---|
| `BadRequestError` | `BAD_REQUEST` | 400 |
| `ValidationError` | `VALIDATION_ERROR` | 400 |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ConflictError` | `CONFLICT` | 409 |
| `ServiceUnavailableError` | `SERVICE_UNAVAILABLE` | 503 |
| `GatewayTimeoutError` | `GATEWAY_TIMEOUT` | 504 |

401 errors originating in identity-service (expired token, invalid token,
revoked token) are mapped to `UnauthorizedError` by the upstream client and
forwarded as `UNAUTHORIZED`. The BFF does not classify them further.

Resource-specific codes can be thrown via
`new AppError(404, 'USER_NOT_FOUND', 'User not found')` when a more
specific code is warranted.

## Consequences

**Pros**

- Single contract for frontend callers; SDK generation is straightforward.
- New routes get the correct error shape for free — just throw the right
  subclass.
- Codes are stable and searchable across logs, the codebase, and frontend
  integration code.
- Upstream internals never reach the client.

**Cons**

- Slightly more verbose than `reply.code(404).send({ message: 'not found' })`.
- Picking a code for a new error type requires explicit thought (small cost,
  but forces discipline).

## ADR format used here

```
# <number>. <Title>

Date: YYYY-MM-DD

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-NNNN

## Context
The forces at play — the problem, the constraints, why this needs deciding now.

## Decision
The choice we made, in active voice. Be specific.

## Consequences
What becomes easier and what becomes harder. List both.
```

New ADRs go in `docs/decisions/` numbered sequentially: `0002-...md`,
`0003-...md`. Once accepted, an ADR is immutable; supersede with a new ADR
rather than edit.
