# Architecture

Directory layout and cross-cutting structure for this BFF.

## Layout

```
src/
├── app.ts                         # buildApp() factory — used by server + tests
├── index.ts                       # process boot only (listen, signals)
├── api/
│   ├── health/health.routes.ts    # GET /health
│   ├── index.ts                   # GET / (rootRoutes)
│   └── <resource>/                # 4 files per resource
│       ├── <resource>.routes.ts   # HTTP layer; plain async (fastify) => {}
│       ├── <resource>.schemas.ts  # TypeBox shapes + $ids + Static<> types
│       ├── <resource>.docs.ts     # OpenAPI per-route schema objects
│       └── <resource>.types.ts    # TS interfaces for upstream responses
├── common/
│   └── docs/commonResponses.ts    # shared error response descriptions
├── config/appConfig.ts            # flat env load with required()
├── plugins/
│   ├── errorHandler.ts            # AppError taxonomy + global error envelope
│   └── swagger.ts                 # OpenAPI options + tags
├── services/                      # one HTTP client file per upstream
│   └── identityService.ts         # canonical example
├── utils/errors.ts                # AppError + subclasses
├── routes.ts                      # registerRoutes() — registers all prefixes
└── index.ts                       # Fastify instance, plugin boot, process signals
```

```
tests/
├── helpers/build-test-app.ts      # buildTestApp() — wraps buildApp() with logger: false
└── routes/                        # smoke + integration tests
    ├── health.test.ts
    └── root.test.ts
```

## Layered request flow

```
HTTP request
  ↓
Fastify route                (<resource>.routes.ts)
  ↓
Schema validation            (<resource>.schemas.ts via TypeBox + AJV)
  ↓
Handler
  ↓
Upstream HTTP client         (services/<upstream>.ts — fetch + error mapping)
  ↓
Upstream service
```

Errors thrown anywhere bubble to the global error handler and serialise to:

```json
{ "error": { "code": "NOT_FOUND", "message": "User not found", "status": 404 } }
```

See [ADR-0001](decisions/0001-standard-error-response-format.md).

## Adding a cross-service upstream

The identity integration (`src/services/identityService.ts`) is the worked
example. Follow the same pattern for any additional upstream:

1. Add `<UPSTREAM>_URL` and `<UPSTREAM>_TIMEOUT` to `src/config/appConfig.ts`.
2. Add the vars to `.env.example`.
3. Create `src/services/<upstream>Service.ts` — one module-level client per
   upstream. Expose named verb functions:
   `<upstream>ServiceGet`, `<upstream>ServicePost`, `<upstream>ServicePatch`,
   `<upstream>ServicePut`, `<upstream>ServiceDelete`.
   Each verb must accept a trailing optional `reqId?: string` parameter and
   forward it as `x-request-id` in the upstream request headers (see the
   `identityService.ts` pattern).
4. Implement the same error-mapping shape as `identityService.ts`:
   - 404 → `NotFoundError`
   - ≥500 → `ServiceUnavailableError`
   - AbortError → `GatewayTimeoutError`
   - upstream `{ error: { code, ... } }` body → `new AppError(...)`
5. Register the upstream's tag in `src/plugins/swagger.ts` if resources for
   this upstream need a distinct tag.

Never create per-domain wrapper clients (`usersIdentityService.ts`,
`brandsIdentityService.ts`). One file per upstream, used directly by route
handlers.
