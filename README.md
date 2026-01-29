# Busk Cats

A Cloudflare Worker that manages email subscriptions for a blog. Users subscribe via a form on the site, confirm via double opt-in, and receive emails when new posts are published. The blog owner sends emails via a CLI.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Email**: [Resend](https://resend.com)
- **CLI**: TypeScript via `tsx`

## Setup

### Prerequisites

- A Cloudflare account with Wrangler installed and authenticated (`wrangler login`)
- A Resend account with a verified sending domain
- Node.js

### 1. Create the D1 database

```bash
wrangler d1 create email-subscribers
```

Copy the output `database_id` into `wrangler.toml`.

### 2. Apply the schema

```bash
wrangler d1 execute email-subscribers --file=schema.sql
```

### 3. Set secrets

```bash
wrangler secret put RESEND_API_KEY
wrangler secret put SEND_SECRET
```

Generate the send secret with `openssl rand -hex 32`.

### 4. Update `wrangler.toml`

Set `WORKER_URL` to your deployed worker URL and `FROM_EMAIL` to your verified sending address.

### 5. Deploy

```bash
npm install
wrangler deploy
```

### 6. Configure the CLI

Create a `.env` file in the project root:

```
WORKER_URL=https://email-subscribe.<account>.workers.dev
SEND_SECRET=<your secret>
```

## CLI Usage

All commands are run via `npx tsx src/cli.ts`.

### List subscribers

```bash
npx tsx src/cli.ts list
```

### Send an email to all confirmed subscribers

```bash
npx tsx src/cli.ts send --subject "New post: Title" --html "<p>Check out my new post</p>"
```

Or from a file:

```bash
npx tsx src/cli.ts send --subject "New post: Title" --html-file email.html
```

### Delete a subscriber

```bash
npx tsx src/cli.ts delete --email "someone@example.com"
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/subscribe` | POST | Public | Subscribe an email (JSON body: `{ "email": "..." }`) |
| `/confirm` | GET | Token | Confirm subscription via token query param |
| `/unsubscribe` | GET | Token | Unsubscribe via token query param |
| `/send` | POST | Bearer | Send email to all confirmed subscribers |
| `/admin/list` | GET | Bearer | List all subscribers |
| `/admin/delete` | POST | Bearer | Delete a subscriber by email |

Admin endpoints require `Authorization: Bearer <SEND_SECRET>` header.
