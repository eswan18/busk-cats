import type { Env } from "../env";
import { json } from "../cors";
import { readSession, type SessionPayload } from "../auth/session";
import {
  deleteByEmail,
  getConfirmedSubscribers,
  insertConfirmedSubscriber,
  insertPendingSubscriber,
  insertSentNotification,
  listListSummaries,
  listSentNotifications,
  listSubscribers,
} from "../db";
import { sendEmail, sendToList } from "../email";

async function requireSession(request: Request, env: Env): Promise<SessionPayload | Response> {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return json({ error: "Unauthorized" }, 401);
  return session;
}

export async function handleApiMe(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  return json({ username: session.username });
}

export async function handleApiLists(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const lists = await listListSummaries(env.DB);
  return json(lists);
}

export async function handleApiSubscribersGet(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const url = new URL(request.url);
  const list = url.searchParams.get("list") ?? undefined;
  const subs = await listSubscribers(env.DB, list);
  return json(subs);
}

export async function handleApiSubscribersPost(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const body = await request.json<{ email?: string; list?: string; skipConfirmation?: boolean }>();
  const email = body?.email?.trim().toLowerCase();
  const list = body?.list?.trim();
  const skipConfirmation = body?.skipConfirmation ?? true;
  if (!email || !email.includes("@")) return json({ error: "Invalid email" }, 400);
  if (!list) return json({ error: "Missing list" }, 400);

  const token = crypto.randomUUID();
  if (skipConfirmation) {
    const result = await insertConfirmedSubscriber(env.DB, email, list, token);
    if ("error" in result) return json({ error: "Already subscribed" }, 409);
    return json({ ok: true, confirmed: true });
  }

  const result = await insertPendingSubscriber(env.DB, email, list, token);
  if ("error" in result) return json({ error: "Already subscribed" }, 409);

  const confirmUrl = `${env.WORKER_URL}/confirm?token=${token}`;
  await sendEmail(
    env,
    email,
    "Confirm your subscription",
    `<p>Thanks for subscribing! Please <a href="${confirmUrl}">click here to confirm</a>.</p>`,
  );
  return json({ ok: true, confirmed: false });
}

export async function handleApiSubscribersDelete(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const body = await request.json<{ email?: string; list?: string }>();
  if (!body?.email) return json({ error: "Missing email" }, 400);
  const email = body.email.trim().toLowerCase();
  const deleted = await deleteByEmail(env.DB, email, body.list);
  if (!deleted) return json({ error: "Not found" }, 404);
  return json({ ok: true, deleted });
}

export async function handleApiSend(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const body = await request.json<{
    subject?: string;
    html?: string;
    list?: string;
    link?: string;
  }>();
  if (!body?.subject || !body?.html || !body?.list) {
    return json({ error: "Missing subject, html, or list" }, 400);
  }
  const subscribers = await getConfirmedSubscribers(env.DB, body.list);
  const sent = await sendToList(env, subscribers, body.subject, body.html);
  await insertSentNotification(env.DB, {
    list: body.list,
    subject: body.subject,
    html: body.html,
    post_link: body.link ?? null,
    recipient_count: sent,
    sent_by: session.username,
  });
  return json({ sent });
}

export async function handleApiSentList(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const url = new URL(request.url);
  const list = url.searchParams.get("list") ?? undefined;
  const results = await listSentNotifications(env.DB, list);
  return json(results);
}
