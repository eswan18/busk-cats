# Busk Cats — Project Spec

## Overview

A Cloudflare Worker + D1 system that manages email subscriptions across multiple mailing lists. Users subscribe via a form, confirm via double opt-in, and receive email notifications when new content is published. The owner triggers sends manually via a CLI.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Email**: Resend API (https://resend.com)
- **CLI**: TypeScript, runnable via `tsx`

---

# Part A: Build Instructions (for the implementing agent)

## Project Structure

```
busk-cats/
├── src/
│   ├── worker.ts          # Cloudflare Worker (all endpoints)
│   └── cli.ts             # CLI for admin operations
├── schema.sql             # D1 table schema
├── wrangler.toml          # Cloudflare Worker config
├── package.json
├── tsconfig.json
└── .gitignore
```

## Database Schema (`schema.sql`)

```sql
CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  list TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  confirmed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(email, list)
);
```

- `list` is a freeform string identifying which mailing list the subscription belongs to.
- `token` is a random UUID generated at subscribe time.
- `confirmed` is 0 until the user clicks the confirmation link.
- The same email can subscribe to multiple lists (unique constraint is on the pair).

## Worker Endpoints (`src/worker.ts`)

The worker needs access to the following bindings/env vars:
- `DB` — D1 database binding
- `RESEND_API_KEY` — Resend API key (set via `wrangler secret`)
- `ADMIN_SECRET` — shared secret for admin endpoints (set via `wrangler secret`)
- `FROM_EMAIL` — the "from" email address (set in `wrangler.toml` vars)
- `WORKER_URL` — the worker's public URL, used to construct confirmation/unsubscribe links (set in `wrangler.toml` vars)
- `ALLOWED_ORIGINS` — comma-separated list of origins allowed to call public endpoints (set in `wrangler.toml` vars)

### `POST /subscribe` (Public)

- Accepts JSON body: `{ "email": "...", "list": "..." }`
- Validates that the email contains `@` and list is provided
- Generates a random UUID token
- Inserts a row into `subscribers` with `confirmed = 0`
- Sends a confirmation email via Resend with a link to `/confirm?token=<token>`
- Returns `200 { "ok": true }` on success
- Returns `409 { "error": "Already subscribed" }` if the email+list pair already exists
- Returns `400 { "error": "Invalid email" }` or `{ "error": "Missing list" }` for bad input

### `GET /confirm?token=<token>` (Public, token-authenticated)

- Looks up the subscriber by token
- Sets `confirmed = 1`
- Returns a simple HTML page saying "You're subscribed!"
- Returns 404 if token not found

### `GET /unsubscribe?token=<token>` (Public, token-authenticated)

- Looks up the subscriber by token
- Deletes the row from `subscribers`
- Returns a simple HTML page saying "You've been unsubscribed."
- Returns 404 if token not found

### `POST /send` (Admin, Bearer token auth)

- Requires header: `Authorization: Bearer <ADMIN_SECRET>`
- Accepts JSON body: `{ "subject": "...", "html": "...", "list": "..." }`
- Queries all subscribers where `confirmed = 1` and `list` matches
- Sends an email to each via Resend API
- Each email's HTML has the subscriber's unsubscribe link appended
- Returns `200 { "sent": <count> }`
- Returns `401` if auth fails

### `POST /admin/delete` (Admin, Bearer token auth)

- Requires header: `Authorization: Bearer <ADMIN_SECRET>`
- Accepts JSON body: `{ "email": "...", "list": "..." }` (list is optional)
- If list is provided, deletes only that subscription; otherwise deletes all subscriptions for the email
- Returns `200 { "ok": true, "deleted": <count> }` on success
- Returns `404` if email not found
- Returns `401` if auth fails

### `GET /admin/list` (Admin, Bearer token auth)

- Requires header: `Authorization: Bearer <ADMIN_SECRET>`
- Optional query param `?list=<name>` to filter by list
- Returns JSON array of all subscribers with email, list, confirmed status, and created_at
- Returns `401` if auth fails

### CORS

CORS headers are set dynamically based on the `ALLOWED_ORIGINS` env var (comma-separated list of allowed origins). The `Origin` header of each request is checked against the list.

### Error Handling

Return JSON error responses with appropriate HTTP status codes. Don't leak internal details.

## CLI (`src/cli.ts`)

A command-line tool for admin operations. Runnable via `npx tsx src/cli.ts <command>`.

The CLI reads config from environment variables (via `.env`):
- `WORKER_URL` — the deployed worker URL
- `ADMIN_SECRET` — the admin secret

### Commands

#### `send`

```
npx tsx src/cli.ts send --list my-blog --subject "New post: Title" --html "<p>Hello</p>"
npx tsx src/cli.ts send --list my-blog --subject "New post: Title" --html-file email.html
```

#### `list`

```
npx tsx src/cli.ts list
npx tsx src/cli.ts list --list my-blog
```

#### `delete`

```
npx tsx src/cli.ts delete --email "someone@example.com" --list my-blog
npx tsx src/cli.ts delete --email "someone@example.com"
```

## `wrangler.toml`

```toml
name = "busk-cats"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[vars]
WORKER_URL = "https://busk-cats.<account>.workers.dev"
FROM_EMAIL = "buskcats@mail.identity.ethanswan.com"
ALLOWED_ORIGINS = "https://ethanswan.com"

[[d1_databases]]
binding = "DB"
database_name = "newsletter-subscribers"
database_id = "<filled in after creation>"
```

Secrets (`RESEND_API_KEY`, `ADMIN_SECRET`) are set via `wrangler secret put`.

---

# Part B: Setup & Deployment Instructions (for the blog owner)

## 1. Create a Resend Account

1. Sign up at https://resend.com
2. Add and verify your sending domain — Resend will give you DNS records to add
3. Generate an API key

## 2. Install Wrangler & Authenticate

```bash
npm install
npx wrangler login
```

## 3. Create the D1 Database

```bash
npx wrangler d1 create newsletter-subscribers
```

Copy the database ID into `wrangler.toml`.

## 4. Apply the Schema

```bash
npx wrangler d1 execute newsletter-subscribers --file=schema.sql
```

## 5. Set Secrets

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_SECRET
```

Generate admin secret with: `openssl rand -hex 32`

## 6. Deploy

```bash
npx wrangler deploy
```

Update `WORKER_URL` in `wrangler.toml` if needed and redeploy.

## 7. Configure Local CLI

Create a `.env` file:

```
WORKER_URL=https://busk-cats.<account>.workers.dev
ADMIN_SECRET=<the same secret from step 5>
```

Test: `npx tsx src/cli.ts list`

## 8. Add Subscribe Forms to Your Sites

Each site/blog needs a form that POSTs to `/subscribe` with both `email` and `list` fields. See the README for an example.

## 9. Optional: Cloudflare Rate Limiting

Add a rate limiting rule for `/subscribe` in the Cloudflare dashboard (Security > WAF > Rate Limiting Rules) to prevent abuse.
