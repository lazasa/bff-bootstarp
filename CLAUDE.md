# CLAUDE.md — BFF Bootstrap

This file tells Claude Code (and humans) how to work in this repository.

## What this is

A **BFF (Backend-for-Frontend)** built on Fastify + TypeScript. It proxies
upstream services over HTTP. **It does not own a database** — there is no
Supabase plugin, no migrations folder, no repositories.

If a route needs domain data, it calls the upstream service. Auth is the
upstream's job: BFFs forward the `Authorization` header and never re-issue
tokens.

## Stack

- Node 22 LTS, TypeScript 6
- Fastify 5
- `@sinclair/typebox` for schemas, AJV for validation
- `@fastify/swagger` + `@fastify/swagger-ui`
- pnpm, node-tap

## Commands

```bash
pnpm dev        # tsx watch
pnpm build      # tsc -p tsconfig.json
pnpm start      # node --env-file=.env dist/index.js
pnpm test       # tap
```

## Layout

```
src/
├── api/
│   ├── health/health.routes.ts
│   ├── <resource>/                # 4 files per resource
│   │   ├── <resource>.routes.ts
│   │   ├── <resource>.schemas.ts
│   │   ├── <resource>.docs.ts
│   │   └── <resource>.types.ts
│   └── index.ts                   # rootRoutes
├── common/docs/commonResponses.ts # reusable error response descriptions
├── config/appConfig.ts            # flat env load
├── plugins/
│   ├── errorHandler.ts
│   └── swagger.ts
├── services/                      # one HTTP client per upstream
├── utils/errors.ts                # AppError + subclasses
├── routes.ts
└── index.ts
```

## Core rules

### 1. Plugin order is load-bearing

In `src/index.ts`:

1. `errorHandler` **first** (catches errors from all later plugins).
2. `swagger` (OpenAPI generator).
3. `registerRoutes(server)`.
4. `swaggerUI` **last** (so it picks up the registered routes).

Don't reorder. If a new plugin is needed, slot it between `swagger` and
`registerRoutes`.

### 2. Errors

- Every thrown error extends `AppError` from `src/utils/errors.ts`. Use
  `NotFoundError`, `BadRequestError`, `ConflictError`, `UnauthorizedError`,
  `ForbiddenError`, `ServiceUnavailableError`, `GatewayTimeoutError`,
  `ValidationError`.
- Response shape is always `{ error: { code, message, status, details? } }`.
- **Never reformat in handlers.** Throw and let `errorHandler` serialise it.
- Map upstream errors **inside the upstream client**, not in handlers. The
  shipped `services/identityService.ts` shows the canonical mapping (404 →
  `NotFoundError`, ≥500 → `ServiceUnavailableError`, AbortError →
  `GatewayTimeoutError`, upstream `{error:{code,...}}` body →
  `new AppError(...)`).

### 3. Validation

- AJV is configured with `removeAdditional: false`. Unknown fields → 400.
- Every body / query / params schema sets `additionalProperties: false`.
- Pull `Static<>` types from the schemas — don't hand-write them.

### 4. Resource pattern (4 files)

Every resource lives in `src/api/<resource>/` with exactly:

- `<resource>.schemas.ts` — TypeBox schemas + `Static<>` types.
- `<resource>.docs.ts` — one entry per operation; spread
  `commonErrorResponses` into every `response`.
- `<resource>.routes.ts` — plain `async (fastify) => {}` (not wrapped with
  `fastify-plugin`); spread the docs entry into `schema:`.
- `<resource>.types.ts` — TS interfaces for upstream responses.

Don't invent extra files per resource. If logic grows, refactor — don't
add an extra layer.

### 5. One HTTP client per upstream service

`src/services/<upstream>.ts` is a single client per upstream — never wrap
it with per-domain helpers. Domain code (resource routes) calls the
upstream verbs directly. The shipped client exposes
`identityServiceGet/Post/Patch/Put/Delete`.

If you find yourself writing `usersIdentityService.ts` or
`brandsIdentityService.ts`, stop — there's only one identity client.

### 6. Forward `Authorization` upstream

Protected routes pass `request.headers.authorization` to upstream calls.
The BFF never re-issues tokens, never decodes JWTs locally, never asks the
user to authenticate again. That's the upstream's job.

### 7. Health endpoint

`GET /health` returns `{ status: 'healthy' }`. Don't remove it — the
`Dockerfile` healthcheck calls it.

### 8. Errors: descriptive in logs, consumer-safe on the wire

The BFF is **consumer-facing** — error messages are seen by the end user
or the frontend. Be descriptive enough to debug, but never leak business
implementation, internal IDs, schema names, SQL, stack traces, or
upstream-service internals.

- **On the wire (what the client sees):** short, actionable, intent-only
  language. ✅ `"User not found"`, `"Email already in use"`,
  `"This action requires sign-in"`. ❌ `"identity-service returned 500
  from /v1/users/lookup_by_email"`, `"PGRST116 no rows"`, `"redis
  timeout after 3 retries"`, `"orkha_identity_service.users row
  missing"`.
- **In logs (what the developer sees):** be lavish. Log the upstream
  URL, status code, request id, retry count, parsed body — anything that
  helps reproduce the failure. Use `request.log.warn({ upstream, status,
  attempt }, 'identity-service 5xx, retrying')`. The global
  `errorHandler` already logs the thrown error with request context;
  add log lines only when you can attach information the handler can't
  see.
- **Use `request.log`, not `console`.** It carries the request id and
  pino redacts `Authorization` headers.
- **Pick the right error class.** `BadRequestError`, `NotFoundError`,
  `ConflictError`, `UnauthorizedError`, `ForbiddenError`,
  `ServiceUnavailableError`, `GatewayTimeoutError`. Don't reach for
  `AppError` directly unless none of the subclasses fit.
- **Validation errors carry `details[]`.** `errorHandler` already builds
  the `details` array from AJV output; if you throw `ValidationError`
  manually, populate `details` with `{ field, issue }` so the client
  knows which field broke. The field/issue text is consumer-facing —
  same rule applies (no schema names, no SQL).
- **Map upstream errors at the client boundary.**
  `services/<upstream>.ts` already collapses upstream specifics into
  `NotFoundError`, `ServiceUnavailableError`, etc. Don't re-leak the
  upstream's raw error body in route handlers.

### 9. OpenAPI docs are consumer-faced

`docs.ts` is read by frontend developers and external API consumers.
Write just enough for them to make a successful request — not internal
context.

- **Include:** what the endpoint does (one sentence), required auth,
  required fields, the response shape, the meaningful error codes the
  client should handle (`401`, `404`, `409`, etc.).
- **Omit:** which upstream service is called, internal service names,
  DB schema details, business-process rationale, "why we built this
  this way", links to internal Slack/ADRs, retry/circuit-breaker
  internals.
- **Examples should be realistic but generic.** Don't paste real
  customer data or production IDs.

If you find yourself writing "this endpoint proxies to identity-service
and validates the JWT against Supabase" — stop. That belongs in
`CLAUDE.md` (this file), not in the OpenAPI description.

## What this BFF must NOT do

- Connect to Supabase or any database directly.
- Hold migrations (`supabase/`).
- Implement repositories or `BaseRepository`.
- Decode JWTs to extract claims (let the upstream do it; call
  `/v1/auth/me` if the BFF needs identity context).
- Map a single upstream service across multiple "service" wrappers.

If a feature needs any of the above, it probably belongs in a service
(see `orkha-service-bootstrap`), not a BFF.

## Adding a new resource (recipe)

1. Create `src/api/<resource>/{schemas,docs,routes,types}.ts`.
2. Register the routes at their prefix in `src/routes.ts`.
3. Add the resource's tag to `src/plugins/swagger.ts` `tags`.
4. If it talks to a new upstream, add `src/services/<upstream>.ts` and a
   matching `<UPSTREAM>_URL` to `.env.example` and `appConfig.ts`.

## Adding a new upstream service

1. Add `<UPSTREAM>_URL` and `<UPSTREAM>_TIMEOUT` to `appConfig.ts`.
2. Add the env var to `.env.example`.
3. Create `src/services/<upstream>Service.ts` modelled on
   `identityService.ts` — the same `request()` + `Get/Post/Patch/Put/Delete`
   verb wrappers, the same error-mapping shape.
