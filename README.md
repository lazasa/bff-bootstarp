# orkha-bff-bootstrap

Bootstrap template for Orkha BFF (Backend-for-Frontend) APIs. Clone, rename,
add your resources.

## Stack

- Fastify 5 + TypeScript 6 (Node 22 LTS)
- TypeBox + AJV (`removeAdditional: false`)
- `@fastify/swagger` + `swagger-ui` at `/docs`
- node-tap for tests
- pnpm

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # tsx watch — hot-reload dev server on :3000
pnpm build            # tsc compile to dist/
pnpm start            # run compiled dist/index.js
pnpm test             # tap test suite
```

## What to change after cloning

1. `package.json`: rename `name`, set `description`.
2. `.env.example` and `.env`: replace `IDENTITY_SERVICE_URL` with your real
   upstream URLs; add one env var per upstream.
3. `src/config/appConfig.ts`: add config entries for new upstreams.
4. `src/services/`: add one HTTP client file per upstream service. Never
   wrap a single upstream with multiple per-domain clients.
5. `src/api/users/` is the example resource — replace it with your own
   resources. Each resource folder has 4 files: `routes`, `schemas`,
   `docs`, `types`.
6. `src/routes.ts`: register your resources at their prefixes.
7. `src/plugins/swagger.ts`: replace title, description, tags.
8. `.github/workflows/deploy-staging.yml`: set `SERVICE_NAME`.

## Read this before writing code

- [`CLAUDE.md`](./CLAUDE.md) captures the architectural rules: plugin order,
  no-database, single client per upstream, error contract, AJV config.

## Health & docs

- `GET /health` returns `{ status: 'healthy' }`. Don't remove it — Docker
  depends on it.
- `GET /docs` renders Swagger UI for the registered routes.
