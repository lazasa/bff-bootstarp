# API structure

How `orkha-bff-bootstrap` is organised, and how to extend it without breaking conventions.

## Stack

- **Fastify v5** — HTTP server
- **TypeScript** (CommonJS, targeting ES2022)
- **TypeBox** + AJV — runtime schema validation; `removeAdditional: false` so unknown fields → 400
- **`@fastify/swagger` + `@fastify/swagger-ui`** — OpenAPI 3.1 docs at `/docs`
- **vitest** — tests

## Layout

```
src/
├── app.ts                         # buildApp() factory — used by server + tests
├── index.ts                       # process boot only (listen, signals)
├── routes.ts                      # registerRoutes() — registers all route plugins
├── api/
│   ├── index.ts                   # GET / (hidden from docs)
│   ├── health/health.routes.ts    # GET /health (hidden from docs)
│   └── <resource>/                # 4 files per resource
│       ├── <resource>.routes.ts   # HTTP layer; plain async (fastify) => {}
│       ├── <resource>.schemas.ts  # TypeBox shapes + $ids + Static<> types
│       ├── <resource>.docs.ts     # OpenAPI per-route schema objects
│       └── <resource>.types.ts    # TS interfaces for upstream responses
├── common/
│   └── docs/commonResponses.ts    # shared error response descriptions
├── config/appConfig.ts            # flat env load
├── plugins/
│   ├── errorHandler.ts            # AppError taxonomy + global error envelope
│   └── swagger.ts                 # OpenAPI options + tags
├── services/                      # one HTTP client module per upstream
│   └── identityService.ts         # canonical example
└── utils/errors.ts                # AppError + subclasses
```

See [architecture.md](architecture.md) for the directory tree and the
upstream-addition recipe.

## Layered request flow

```
HTTP request
  ↓
Fastify route              (<resource>.routes.ts)
  ↓
Schema validation          (<resource>.schemas.ts via TypeBox + AJV)
  ↓
Handler → upstream client  (services/<upstream>.ts)
  ↓
Upstream service
```

Errors thrown anywhere bubble to the global error handler and serialise to:

```json
{ "error": { "code": "NOT_FOUND", "message": "User not found", "status": 404 } }
```

See [ADR-0001](decisions/0001-standard-error-response-format.md).

## Conventions

### REST verbs

`GET` (read), `POST` (create → `201`), `PATCH` (partial update),
`DELETE` (→ `204`).

### Schema `$id`s

Give every TypeBox schema a resource-prefixed `$id` so they appear in the
OpenAPI `components/schemas` section and are referenced (not duplicated)
across operations.

```ts
// users.schemas.ts
export const UserSchema = Type.Object({ ... }, { $id: 'User' })
export const UserIdParamsSchema = Type.Object({ ... }, { $id: 'UserIdParams' })
export const UserCreateRequestSchema = Type.Object({ ... }, { $id: 'UserCreateRequest' })
```

Examples of the `$id` naming pattern: `<Resource>`, `<Resource>CreateRequest`,
`<Resource>UpdateRequest`, `<Resource>IdParams`, `<Resource>ListQuery`,
`<Resource>List`.

Call `fastify.addSchema(...)` for each schema at the top of the route
plugin so they are registered before any route references them.

### Schema examples

Every **parameter property** (path, query, header) must carry `example`,
`default`, or `enum`. Every **request body** schema must have a top-level
`example` on the `Type.Object` options. This keeps Swagger UI useful for
frontend developers without requiring them to guess field names or types.

```ts
// params — every property has example
const UserIdParamsSchema = Type.Object(
  { id: Type.String({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' }) },
  { $id: 'UserIdParams', additionalProperties: false }
)

// request body — top-level example
const UserCreateRequestSchema = Type.Object(
  {
    email: Type.String({ format: 'email', example: 'alice@example.com' }),
    name: Type.String({ example: 'Alice' }),
  },
  {
    $id: 'UserCreateRequest',
    additionalProperties: false,
    example: { email: 'alice@example.com', name: 'Alice' },
  }
)
```

### Enums

Prefer `Type.String({ enum: ['a', 'b'] })` over
`Type.Union([Type.Literal('a'), Type.Literal('b')])`. The former serialises
as `enum` in the OpenAPI spec; the latter as `anyOf`, which most spec
consumers can't expand correctly.

### Error messages on the wire

The BFF is **consumer-facing** — messages are read by frontend developers
and end users. Every error message must be short, actionable, and free of
implementation detail.

- ✅ `"User not found"`, `"Email already in use"`, `"Sign in required"`
- ❌ `"identity-service returned 500 from /v1/users/lookup_by_email"`,
  `"PGRST116 no rows returned"`, `"fetch failed after 3 retries"`

Full upstream context belongs in logs (`request.log.warn`), not in the
response body. See CLAUDE.md Rules 2 and 8.

### `commonErrorResponses`

Spread `commonErrorResponses` into the `response` object of every route
schema in `<resource>.docs.ts`. This wires the standard error statuses into
the generated OpenAPI spec without repeating them per route.

```ts
import { commonErrorResponses } from '../../common/docs/commonResponses'

export const userGetDocs = {
  schema: {
    tags: ['users'],
    summary: 'Get a user by ID',
    params: { $ref: 'UserIdParams#' },
    response: {
      200: { ... },
      ...commonErrorResponses,
    },
  },
}
```

### AppError subclasses

Prefer the specific subclass over `AppError` directly:

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

Map upstream errors **inside the upstream client** (`services/<upstream>.ts`),
not in route handlers. 401s that originate in identity-service are forwarded
as `UnauthorizedError`; the BFF does not classify them further.

## Adding a new resource

1. Create four files under `src/api/<resource>/`:
   - `<resource>.schemas.ts` — TypeBox schemas with resource-prefixed `$id`s
     and `additionalProperties: false`; export `Static<>` types.
   - `<resource>.docs.ts` — one export per operation; spread
     `commonErrorResponses` into every `response`.
   - `<resource>.routes.ts` — plain `async (fastify) => {}`; spread the
     docs entry into `schema:`; call `fastify.addSchema(...)` for each
     schema at the top.
   - `<resource>.types.ts` — TS interfaces for upstream response shapes.
2. Register the routes at their prefix in `src/routes.ts`.
3. Add the resource's tag to `src/plugins/swagger.ts`.
4. If the resource talks to a new upstream, add `src/services/<upstream>Service.ts`
   and the matching env vars (see [architecture.md](architecture.md)).

## Configuration

| Variable | Purpose | Required |
|---|---|---|
| `PORT` | HTTP port (default `3000`) | No |
| `HOST` | Bind host (default `0.0.0.0`) | No |
| `LOG_LEVEL` | Pino level (default `info`) | No |
| `NODE_ENV` | `production` / `development` | No |
| `IDENTITY_SERVICE_URL` | identity-service base URL (default `http://127.0.0.1:5000` in dev) | Production |
| `IDENTITY_SERVICE_TIMEOUT` | HTTP timeout ms (default `30000`) | No |

Add one `<UPSTREAM>_URL` and one `<UPSTREAM>_TIMEOUT` entry per upstream
service you introduce.

## Graceful shutdown

`src/index.ts` calls `buildApp()` then `app.listen()`, then installs signal
handlers. On `SIGINT` or `SIGTERM`:

1. A `shuttingDown` flag prevents re-entry if the signal fires twice.
2. A 10-second `forceExit` timer is started (`.unref()` so it doesn't
   block a clean exit).
3. `app.close()` is awaited. On success: `clearTimeout(forceExit)`,
   `process.exit(0)`. On error: `process.exit(1)`. If the timer fires
   first: `process.exit(1)` with an error log.
