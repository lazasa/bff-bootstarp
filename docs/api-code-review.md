# API code review

**Score: 4.5 / 5** as a BFF bootstrap template.

> Helmet, CORS, and rate-limit are intentionally out of scope — they live at the upstream API gateway. Excluded from this review.

## What's good

### Architecture

- **Plugin order is load-bearing and documented** — `errorHandler` → `swagger` → `registerRoutes` → `swaggerUI`. Lives in `src/app.ts`; `src/index.ts` is process boot only. The order is described in CLAUDE.md Rule 1.
- **`buildApp()` factory** — `app.ts` builds the instance; `index.ts` handles process concerns only. Tests reuse the same factory (`buildTestApp`) so production wiring is what's under test.
- **Graceful shutdown** — `SIGINT`/`SIGTERM` with a re-entry guard and 10-second force-exit safety net (`.unref()`). Exit codes 0 (clean) and 1 (error/timeout).
- **Single HTTP client per upstream** — `src/services/identityService.ts` is the canonical example. Module-level named verb functions; no per-domain wrappers.
- **No database ownership** — the BFF proxies upstream services. No Supabase client, no migrations folder, no repositories. This boundary is explicit in CLAUDE.md.
- **Authorization header forwarded, never decoded** — passes `request.headers.authorization` upstream. No JWT verification locally.
- **Request-id propagation** — `genReqId` reads `x-request-id` / `x-correlation-id` from the inbound request (falls back to UUID). Each upstream verb accepts a trailing `reqId` parameter and forwards it as `x-request-id`.
- **Consumer-safe error messages** — upstream internals mapped to intent-only messages at the client boundary (`services/<upstream>.ts`).
- **`Authorization` header redacted in logs** — pino configured with `redact: ['req.headers.authorization']`.
- **pino-pretty in dev** — `NODE_ENV !== 'production'` activates the pino transport; production uses raw JSON.

### Contract

- **OpenAPI 3.1** generated from runtime TypeBox schemas — docs can't drift from the implementation.
- **Single error envelope** (`{ error: { code, message, status, details? } }`) covering thrown errors, validation failures, 404s, and unhandled errors. Documented in [ADR-0001](decisions/0001-standard-error-response-format.md).
- **`ErrorResponseSchema`** — registered via `fastify.addSchema` in `errorHandler.ts`; appears in `components/schemas`; referenced by `commonErrorResponses` in every route.
- **`AppError` taxonomy** — 8 subclasses with stable codes. Callers branch on `code`, not message text.
- **AJV `removeAdditional: false`** — unknown fields return `400 VALIDATION_ERROR` rather than silently dropping.

### Testing

- vitest + `fastify.inject()` covering two layers — smoke (no upstream traffic) and integration (`vi.spyOn` upstream module mocks). Documented in [test.md](test.md).

### Documentation

- CLAUDE.md is a complete architectural contract with BFF-specific rules.
- `docs/` directory: `api.md`, `architecture.md`, `test.md`, ADR-0001.
- `/align-to-bff-bootstrap` slash command for downstream BFFs to self-audit against this template.

## What needs work

### Schema conventions

- **No `$id` discipline yet in shipped example resources.** Rules 10–12 are in CLAUDE.md; the deleted `users` resource was the example but it has been removed. The first real resource added to a downstream BFF must follow these rules.
- **No mandatory examples in shipped resources.** Same as above — rules documented, no living example resource to reference.

### Operational

- **Healthcheck is liveness only.** A readiness probe that fails when upstream services are unreachable would let the gateway route around a broken instance without false-positive 200s.
- **No CI.** `pnpm typecheck` and `pnpm test:run` should run on every PR.

### Configuration

- **`appConfig.ts` has dead code.** `required()` is defined but the BFF currently only uses default values for `IDENTITY_SERVICE_URL`. In production, a missing URL silently falls back to `http://127.0.0.1:5000`. The function should throw in production mode for any required URL.

## Suggested next ADRs

1. Plugin load order as a load-bearing contract (rationale for why the order matters, what breaks if reordered).
2. Authorization forwarding: why the BFF never decodes JWTs, and when it is acceptable to call `/v1/auth/me` to get identity context.
3. Single-client-per-upstream: rationale against per-domain wrapper clients.
4. Consumer-faced OpenAPI prose policy: what to include and omit in `docs.ts` files.
