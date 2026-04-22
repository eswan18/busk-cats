# CLAUDE.md

Guidance for Claude Code when working in this repo. Keep this short; add to it only when something surprises you or takes more than one search to find.

## What this is

A Cloudflare Worker managing email subscriptions for multiple mailing lists, plus a React admin UI served by the same worker. Public subscribe/confirm/unsubscribe endpoints remain CORS-accessible for embeds on external sites. The admin surface has two faces:

- `/admin/*` + `/send` — Bearer `ADMIN_SECRET`, used by the CLI (`src/cli.ts`). **Do not change these signatures** — the CLI still depends on them.
- `/api/*` + `/auth/*` — cookie session auth, used by the SPA in `web/`.

Both call the same pure DB functions in `src/db.ts`. Refactor DB changes there; don't fork the two surfaces.

## Common commands

```bash
npm run deploy         # vite build + wrangler deploy (prod)
npm run dev            # wrangler dev on :8787 (needs .dev.vars)
npm run dev:web        # vite dev on :5173 (proxies API to :8787)
npm run cli -- <cmd>   # run the admin CLI
npx vitest run         # all tests: workers pool + node env
```

Wrangler is **local-only** (devDependency) — use `npx wrangler …`, not `wrangler …` on PATH.

## Architecture notes

- Lists are derived (`SELECT DISTINCT list FROM subscribers`), not a table. Don't invent a `lists` table without asking — the user explicitly opted out.
- `wrangler.toml` uses `[assets] run_worker_first = true` because the array form isn't supported by the wrangler bundled in `@cloudflare/vitest-pool-workers@0.7.8`. The router falls through to `env.ASSETS.fetch(request)` for unmatched paths.
- OIDC against `identity.ethanswan.com` **requires PKCE-S256** even for confidential clients. Don't skip it.
- Session and oauth_state cookies are stateless HMAC-SHA256 (via `src/auth/crypto.ts`). No DB-backed sessions.
- Only `ALLOWED_USERNAME` (hardcoded env var, currently `eswan18`) can access the admin UI. The check happens in `handleAuthCallback` after userinfo.
- `compatibility_date = "2024-09-23"` — needed for modern `[assets]` semantics. Don't drop it.

## Secrets / vars

**Wrangler secrets (prod):** `RESEND_API_KEY`, `ADMIN_SECRET`, `SESSION_SECRET`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.
**Vars (in `wrangler.toml`):** `WORKER_URL`, `FROM_EMAIL`, `ALLOWED_ORIGINS`, `OIDC_ISSUER`, `ALLOWED_USERNAME`.
**Local dev:** `.dev.vars` (git-ignored) holds the same five secret keys.
**CLI:** reads `WORKER_URL` and `ADMIN_SECRET` from env or `--env-file` (dotenv). Uses `.env.prod` by convention, not `.dev.vars`.

## Testing notes

- Workers-pool tests live in `src/*.test.ts`. They use `SELF.fetch(...)` against the full worker with miniflare + a local D1 (test bindings are in `vitest.config.ts`). Use `fetchMock` for outbound Resend / IdP calls — don't hit the real network.
- Node-env tests live in `src-tests/*.test.ts`. Use these for anything that doesn't need the worker runtime (session crypto, PKCE).
- `vitest.workspace.ts` runs both projects. `vitest.config.ts` has `include: ["src/**/*.test.ts"]` so the workers project doesn't try to run node-env files.
- When editing auth/crypto logic, check RFC 7636 vector in `src-tests/oidc.test.ts` still passes.

## Before deploying changes

1. `npx vitest run` — should be 42+ tests, all green.
2. `npm run build` — confirms the SPA still builds.
3. `npm run deploy` — combined build + deploy.

## Gotchas

- `window.location.href = "/"` inside the `api()` wrapper on a 401 caused an infinite loop on the landing page (401 → redirect → 401). The wrapper just throws `ApiError` now; callers decide what to do.
- Only the landing page is shown when `useAuth().me` is null. When logged in, the `<Shell>` renders the nav (brand + username + logout) and the route tree. Don't add nav links back without asking — the user intentionally removed them.
- The `brand` link in the nav is a plain `Link`, not a `NavLink`. Using `NavLink` for both the brand and the "Dashboard" link when both point to `/` caused double-active styling.
- Same-origin fetch from the SPA to `/subscribe` etc. works even though `ALLOWED_ORIGINS` doesn't list the worker's own origin — the browser skips CORS for same-origin requests.

## Things to ask before doing

- Introducing a `lists` table or per-list metadata storage.
- Moving off Cloudflare Workers / D1.
- Bypassing the `ALLOWED_USERNAME` check (e.g. supporting multiple users).
- Changing signatures of `/admin/*` or `/send` endpoints.
- Adding staging / dual environments.
