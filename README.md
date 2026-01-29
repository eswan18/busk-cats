# Busk Cats

A Cloudflare Worker that manages email subscriptions for one or more mailing lists. Users subscribe via a form on a site, confirm via double opt-in, and receive emails when the list owner sends a blast. The owner manages everything via a CLI.

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
wrangler d1 create newsletter-subscribers
```

Copy the output `database_id` into `wrangler.toml`.

### 2. Apply the schema

```bash
wrangler d1 execute newsletter-subscribers --file=schema.sql
```

### 3. Set secrets

```bash
wrangler secret put RESEND_API_KEY
wrangler secret put ADMIN_SECRET
```

Generate the admin secret with `openssl rand -hex 32`.

### 4. Update `wrangler.toml`

- `WORKER_URL` — your deployed worker URL
- `FROM_EMAIL` — your verified sending address
- `ALLOWED_ORIGINS` — comma-separated list of origins allowed to call `/subscribe` (e.g. `https://ethanswan.com,https://otherblog.com`)

### 5. Deploy

```bash
npm install
wrangler deploy
```

### 6. Configure the CLI

Create a `.env` file in the project root:

```
WORKER_URL=https://busk-cats.<account>.workers.dev
ADMIN_SECRET=<your secret>
```

## CLI Usage

All commands are run via `npx tsx src/cli.ts`. Use `--env-file <path>` to load environment variables from a file, or export `WORKER_URL` and `ADMIN_SECRET` directly.

### List subscribers

```bash
# All subscribers across all lists
npx tsx src/cli.ts list

# Filter by list
npx tsx src/cli.ts list --list my-blog
```

### Send an email to a list

```bash
npx tsx src/cli.ts send --list my-blog --subject "New post: Title" --html "<p>Check out my new post</p>"
```

Or from a file:

```bash
npx tsx src/cli.ts send --list my-blog --subject "New post: Title" --html-file email.html
```

### Draft an HTML email

```bash
npx tsx src/cli.ts draft --subject "Stuff is Happening" --text "Yep it's me"
```

Prints a full HTML email document to stdout. Pipe to a file for use with `send --html-file`.

### Add a subscriber directly (skip confirmation)

```bash
npx tsx src/cli.ts add --email "someone@example.com" --list my-blog
```

### Generate a subscribe form snippet

```bash
npx tsx src/cli.ts form --list my-blog
```

Outputs a ready-to-paste HTML form with your worker URL and list name embedded.

### Delete a subscriber

```bash
# From a specific list
npx tsx src/cli.ts delete --email "someone@example.com" --list my-blog

# From all lists
npx tsx src/cli.ts delete --email "someone@example.com"
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/subscribe` | POST | Public | Subscribe an email to a list (JSON: `{ "email": "...", "list": "..." }`) |
| `/confirm` | GET | Token | Confirm subscription via token query param |
| `/unsubscribe` | GET | Token | Unsubscribe via token query param |
| `/send` | POST | Bearer | Send email to confirmed subscribers on a list |
| `/admin/add` | POST | Bearer | Add a subscriber directly (pre-confirmed) |
| `/admin/list` | GET | Bearer | List subscribers (optional `?list=` filter) |
| `/admin/delete` | POST | Bearer | Delete a subscriber by email (optional list filter) |

Admin endpoints require `Authorization: Bearer <ADMIN_SECRET>` header.

## Adding a Subscribe Form

Add a form to your site that POSTs to `/subscribe`:

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
