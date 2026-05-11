# Testing

Two layers — pick the one that fits the kind of bug you're trying to catch.

## Tools

- **vitest** — runner, assertions (`expect`), mocking (`vi.spyOn`)
- **`fastify.inject()`** — exercises the full HTTP pipeline (validation,
  error handler, response serialisation) without binding a port

## Running

```bash
pnpm test          # vitest (watch mode)
pnpm test:run      # vitest run (single run, use in CI)
pnpm typecheck     # tsc --noEmit against src + tests
```

## Layers

### 1. Smoke — routes that don't call upstream

**Files:** `tests/routes/root.test.ts`, `tests/routes/health.test.ts`

Build the app via `buildTestApp()` and hit the route via `inject`. No
upstream client traffic required.

```ts
import { describe, it, expect } from 'vitest'
import { buildTestApp } from '../helpers/build-test-app'

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const app = await buildTestApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ status: 'healthy' })
    } finally {
      await app.close()
    }
  })
})
```

### 2. Integration — routes with a mocked upstream client

**File:** `tests/routes/<resource>.test.ts`

Use `vi.spyOn` to mock the upstream module at the function boundary.
`buildTestApp()` reuses `buildApp()` with `logger: false`, so the full
plugin chain (validation, error handler) is under test.

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as identityService from '../../src/services/identityService'
import { buildTestApp } from '../helpers/build-test-app'

afterEach(() => vi.restoreAllMocks())

describe('GET /v1/users/me', () => {
  it('returns the upstream user payload', async () => {
    vi.spyOn(identityService, 'identityServiceGet').mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
    })

    const app = await buildTestApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(res.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('returns 503 when upstream is unavailable', async () => {
    vi.spyOn(identityService, 'identityServiceGet').mockRejectedValue(
      new (await import('../../src/utils/errors')).ServiceUnavailableError()
    )

    const app = await buildTestApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(res.statusCode).toBe(503)
      expect(res.json().error.code).toBe('SERVICE_UNAVAILABLE')
    } finally {
      await app.close()
    }
  })
})
```

Always call `await app.close()` in a `finally` block.

## The `buildTestApp` helper

[`tests/helpers/build-test-app.ts`](../tests/helpers/build-test-app.ts)
wraps `buildApp()`:

- Logger silenced (`logger: false`) so test output stays clean.
- Accepts any `BuildAppOptions` override (e.g., `genReqId` for a
  deterministic request id in tests).
- No Supabase or auth mocks — the BFF has no database and delegates
  auth upstream. Per-test upstream mocks are done via `vi.spyOn` on the
  module boundary.

## Auth in tests

Protected routes forward `Authorization: Bearer <token>` to the upstream
client. In tests, pass any non-empty token — the BFF forwards it verbatim.
The `vi.spyOn` mock controls what comes back; the BFF never validates the
token locally.

## What to test for a new resource

Create `tests/routes/<resource>.test.ts`. At minimum cover:

- Happy path on each implemented verb (`GET`, `POST`, `PATCH`, `DELETE`).
- Validation failure — assert `VALIDATION_ERROR` envelope and `400`.
- Missing resource — assert `404` and `NOT_FOUND` code.
- Standard error envelope shape `{ error: { code, message, status } }` on
  every error response.
- Upstream unavailable — mock to throw `ServiceUnavailableError`; assert
  `503`.

## What we deliberately don't test

- **Real upstream HTTP calls.** The upstream client is the only place
  making remote calls; mock at that boundary.
- **Schema validation in isolation.** Test through the HTTP entry point so
  AJV wiring bugs surface alongside handler bugs.
- **Fastify internals.** Plugin registration order is tested implicitly by
  the smoke tests booting successfully.
