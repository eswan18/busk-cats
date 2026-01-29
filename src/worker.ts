export interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  SEND_SECRET: string;
  FROM_EMAIL: string;
  WORKER_URL: string;
}

const ALLOWED_ORIGIN = "https://ethanswan.com";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function html(body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Subscription</title></head><body style="font-family:sans-serif;max-width:480px;margin:40px auto;text-align:center;">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html;charset=utf-8" } },
  );
}

async function sendEmail(env: Env, to: string, subject: string, htmlBody: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [to],
      subject,
      html: htmlBody,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error: ${res.status} ${text}`);
  }
}

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${env.SEND_SECRET}`;
}

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ email?: string }>();
  const email = body?.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json({ error: "Invalid email" }, 400);
  }

  const token = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO subscribers (email, token) VALUES (?, ?)")
      .bind(email, token)
      .run();
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      return json({ error: "Already subscribed" }, 409);
    }
    throw e;
  }

  const confirmUrl = `${env.WORKER_URL}/confirm?token=${token}`;
  await sendEmail(
    env,
    email,
    "Confirm your subscription",
    `<p>Thanks for subscribing! Please <a href="${confirmUrl}">click here to confirm</a>.</p>`,
  );

  return json({ ok: true });
}

async function handleConfirm(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return html("<p>Invalid link.</p>", 400);

  const result = await env.DB.prepare("UPDATE subscribers SET confirmed = 1 WHERE token = ?")
    .bind(token)
    .run();

  if (!result.meta.changes) {
    return html("<p>Token not found.</p>", 404);
  }
  return html("<h1>You're subscribed!</h1><p>You'll receive emails when new posts are published.</p>");
}

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return html("<p>Invalid link.</p>", 400);

  const result = await env.DB.prepare("DELETE FROM subscribers WHERE token = ?")
    .bind(token)
    .run();

  if (!result.meta.changes) {
    return html("<p>Token not found.</p>", 404);
  }
  return html("<h1>You've been unsubscribed.</h1><p>You won't receive any more emails.</p>");
}

async function handleSend(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  const body = await request.json<{ subject?: string; html?: string }>();
  if (!body?.subject || !body?.html) {
    return json({ error: "Missing subject or html" }, 400);
  }

  const { results } = await env.DB.prepare("SELECT email, token FROM subscribers WHERE confirmed = 1").all<{
    email: string;
    token: string;
  }>();

  let sent = 0;
  for (const sub of results) {
    const unsubLink = `${env.WORKER_URL}/unsubscribe?token=${sub.token}`;
    const fullHtml = `${body.html}<p><a href="${unsubLink}">Unsubscribe</a></p>`;
    await sendEmail(env, sub.email, body.subject, fullHtml);
    sent++;
  }

  return json({ sent });
}

async function handleAdminDelete(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  const body = await request.json<{ email?: string }>();
  if (!body?.email) return json({ error: "Missing email" }, 400);

  const result = await env.DB.prepare("DELETE FROM subscribers WHERE email = ?")
    .bind(body.email.trim().toLowerCase())
    .run();

  if (!result.meta.changes) {
    return json({ error: "Not found" }, 404);
  }
  return json({ ok: true });
}

async function handleAdminList(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  const { results } = await env.DB.prepare("SELECT email, confirmed, created_at FROM subscribers ORDER BY created_at DESC").all();
  return json(results);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (pathname === "/subscribe" && request.method === "POST") {
        return await handleSubscribe(request, env);
      }
      if (pathname === "/confirm" && request.method === "GET") {
        return await handleConfirm(request, env);
      }
      if (pathname === "/unsubscribe" && request.method === "GET") {
        return await handleUnsubscribe(request, env);
      }
      if (pathname === "/send" && request.method === "POST") {
        return await handleSend(request, env);
      }
      if (pathname === "/admin/delete" && request.method === "POST") {
        return await handleAdminDelete(request, env);
      }
      if (pathname === "/admin/list" && request.method === "GET") {
        return await handleAdminList(request, env);
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "Internal server error" }, 500);
    }
  },
};
