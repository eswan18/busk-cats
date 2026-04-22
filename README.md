# Busk Cats

A Cloudflare Worker that manages email subscriptions for one or more mailing lists. External sites embed a subscribe form that POSTs to the worker. Subscribers confirm via double opt-in. Post announcements are sent through Resend.

Two admin interfaces are built in: a React admin web app at the worker's root URL (auth via self-hosted OIDC) and a TypeScript CLI that talks to the worker's Bearer-authed endpoints.

## Tech stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Email**: [Resend](https://resend.com)
- **Admin UI**: React + Vite SPA, served by the same worker via the `[assets]` binding
- **Auth (UI)**: OAuth 2.0 Authorization Code + PKCE-S256 against a self-hosted OIDC provider; stateless HMAC-signed session cookies
- **Auth (CLI)**: Bearer `ADMIN_SECRET`
- **CLI runtime**: TypeScript via `tsx`

## Architecture

```
src/
├── worker.ts           Thin entry → router
├── router.ts           Pathname dispatch
├── cli.ts              Admin CLI (unchanged; hits Bearer endpoints)
├── cors.ts, db.ts, email.ts, env.ts
├── handlers/
│   ├── public.ts       /subscribe, /confirm, /unsubscribe
│   ├── admin.ts        /admin/*, /send (Bearer auth, used by CLI)
│   ├── api.ts          /api/* (cookie session auth, used by SPA)
│   └── auth.ts         /auth/login, /auth/callback, /auth/logout
└── auth/
    ├── crypto.ts       HMAC sign/verify, b64url, PKCE helpers
    ├── session.ts      Session + oauth_state cookie encode/decode
    └── oidc.ts         Authorization URL, token exchange, userinfo

web/                    React + Vite SPA (Lists, ListDetail, Send, Add,
                        FormSnippet, NewList, Landing). Built to ./dist.
```

Lists are not a first-class entity — they're derived from `SELECT DISTINCT list FROM subscribers`. A list comes into existence when its first subscriber is added (via `/subscribe`, the admin UI's Add page, the CLI's `add`, or the dedicated "new list" page in the UI).

## Setup

### Prerequisites

- Cloudflare account; this project uses local wrangler (no global install needed — `npx wrangler …`)
- Resend account with a verified sending domain
- A self-hosted OIDC provider (this project targets the setup at `identity.ethanswan.com`)
- Node.js 20+

### 1. Create the D1 database

```bash
npx wrangler d1 create newsletter-subscribers
```

Copy the output `database_id` into `wrangler.toml`.

### 2. Apply the schema

```bash
npx wrangler d1 execute newsletter-subscribers --file=schema.sql
```

### 3. Register an OIDC client

On your identity service, register a confidential client with PKCE. Example using the `identity-cli` tool at `identity.ethanswan.com`:

```bash
identity-cli client create \
  --name "busk-cats" \
  --redirect-uris "https://busk-cats.<account>.workers.dev/auth/callback,http://localhost:5173/auth/callback" \
  --scopes "openid,profile" \
  --audience "https://busk-cats.<account>.workers.dev" \
  --confidential
```

Save the `Client ID` and `Client Secret` — they become wrangler secrets (next step).

### 4. Set secrets

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_SECRET           # openssl rand -hex 32
npx wrangler secret put SESSION_SECRET         # openssl rand -base64 48
npx wrangler secret put OIDC_CLIENT_ID
npx wrangler secret put OIDC_CLIENT_SECRET
```

### 5. Update `wrangler.toml` vars

- `WORKER_URL` — your deployed worker URL (used as OAuth redirect base and unsubscribe-link base)
- `FROM_EMAIL` — your verified Resend sender
- `ALLOWED_ORIGINS` — comma-separated origins allowed to POST to `/subscribe` from third-party sites (e.g. `https://ethanswan.com`). The worker's own origin doesn't need to be listed; that's same-origin.
- `OIDC_ISSUER` — base URL of your identity provider (e.g. `https://identity.ethanswan.com`)
- `ALLOWED_USERNAME` — the single username permitted to use the admin UI

### 6. Deploy

```bash
npm install
npm run deploy           # vite build + wrangler deploy
```

## Admin web UI

Open `https://busk-cats.<account>.workers.dev` and click **Log in**. You'll be bounced through the OIDC provider; after it comes back, only the user whose `username` claim matches `ALLOWED_USERNAME` is admitted. Everyone else gets a 403 page.

Pages:
- `/` — list of all mailing lists, with total/confirmed subscriber counts. Includes a "How to create a new list" link.
- `/new-list` — form for bootstrapping a new list by subscribing an email to it (uses the public `/subscribe` flow).
- `/list/:name` — subscriber table + quick actions for that list.
- `/list/:name/send` — compose and send a new-post announcement (with live iframe preview).
- `/list/:name/add` — add a subscriber to this list, with a "skip confirmation email" toggle.
- `/list/:name/form` — generate the HTML subscribe-form snippet for this list.

## Local dev

You need a `.dev.vars` file (git-ignored) mirroring the prod secrets, with whatever values you want for dev:

```
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
SESSION_SECRET=$(openssl rand -base64 48)
ADMIN_SECRET=dev-secret
RESEND_API_KEY=re_...
```

Then run the worker and the Vite dev server in separate terminals:

```bash
npm run dev           # wrangler dev on :8787
npm run dev:web       # vite on :5173 (proxies /api /auth /admin /send /subscribe /confirm /unsubscribe to :8787)
```

Develop against `http://localhost:5173`. For OAuth to work locally, your dev OIDC client needs `http://localhost:5173/auth/callback` in its redirect URIs.

## CLI usage

All commands run via `npm run cli -- <command>` (or `npx tsx src/cli.ts`). Use `--env-file <path>` or export `WORKER_URL` and `ADMIN_SECRET` directly.

### Send a new-post announcement

```bash
npm run cli -- send \
  --list my-blog \
  --title "My Post Title" \
  --link "https://ethanswan.com/posts/my-post" \
  --site-name "ethanswan.com" \
  --site-url "https://ethanswan.com"
```

Subject is `New Post: {title}`. `--subtitle` adds a teaser; `-y`/`--yes` skips the confirmation prompt. Missing required flags are prompted interactively.

### Other CLI commands

```bash
npm run cli -- list [--list my-blog]           # list subscribers
npm run cli -- add --email x@y.com --list my-blog
npm run cli -- delete --email x@y.com [--list my-blog]
npm run cli -- form --list my-blog             # prints HTML snippet
```

## API endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/subscribe` | POST | Public (CORS) | `{ email, list }` → sends confirmation email |
| `/confirm` | GET | Token | Confirms via `?token=` |
| `/unsubscribe` | GET | Token | Removes via `?token=` |
| `/send` | POST | Bearer | `{ subject, html, list }` → sends to confirmed subscribers |
| `/admin/add` | POST | Bearer | Add pre-confirmed subscriber |
| `/admin/list` | GET | Bearer | List subscribers (optional `?list=`) |
| `/admin/delete` | POST | Bearer | Delete subscriber |
| `/auth/login` | GET | — | Initiates OIDC flow |
| `/auth/callback` | GET | `oauth_state` cookie | Completes OIDC flow, sets session |
| `/auth/logout` | POST | Session | Clears session cookie |
| `/api/me` | GET | Session | `{ username }` |
| `/api/lists` | GET | Session | `[{ list, total, confirmed }]` |
| `/api/subscribers` | GET | Session | Subscribers (optional `?list=`) |
| `/api/subscribers` | POST | Session | `{ email, list, skipConfirmation? }` |
| `/api/subscribers` | DELETE | Session | `{ email, list? }` |
| `/api/send` | POST | Session | `{ subject, html, list }` |

Bearer-authed endpoints require `Authorization: Bearer <ADMIN_SECRET>`. Session-authed endpoints use the `session` cookie set by `/auth/callback`.

## Adding a subscribe form to your site

Visit `/list/<name>/form` in the admin UI to copy a ready-made snippet, or hand-write:

```html
<form id="subscribe-form">
  <input type="email" id="subscribe-email" placeholder="you@example.com" required />
  <button type="submit">Subscribe</button>
</form>
<p id="subscribe-message" style="display:none;"></p>
<script>
  document.getElementById("subscribe-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("subscribe-email").value;
    const msg = document.getElementById("subscribe-message");
    try {
      const res = await fetch("https://busk-cats.<account>.workers.dev/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, list: "my-blog" }),
      });
      const data = await res.json();
      msg.textContent = data.ok
        ? "Check your email to confirm your subscription."
        : data.error || "Something went wrong.";
    } catch {
      msg.textContent = "Something went wrong.";
    }
    msg.style.display = "block";
  });
</script>
```

Your site's origin must be in `ALLOWED_ORIGINS` for the cross-origin POST to succeed.

## Tests

```bash
npx vitest run
```

Two vitest projects:
- `workers` — `src/**/*.test.ts`, runs in `@cloudflare/vitest-pool-workers` (miniflare); covers route handlers, CORS, auth gating.
- `node` — `src-tests/**/*.test.ts`, plain node; covers HMAC session crypto and PKCE against RFC 7636 vectors.
