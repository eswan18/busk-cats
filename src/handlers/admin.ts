import type { Env } from "../env";
import { corsJson } from "../cors";
import {
  deleteByEmail,
  getConfirmedSubscribers,
  insertConfirmedSubscriber,
  listSubscribers,
} from "../db";
import { sendToList } from "../email";

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${env.ADMIN_SECRET}`;
}

function unauthorized(request: Request, env: Env): Response {
  return corsJson({ error: "Unauthorized" }, request, env, 401);
}

export async function handleSend(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return unauthorized(request, env);

  const body = await request.json<{ subject?: string; html?: string; list?: string }>();
  if (!body?.subject || !body?.html || !body?.list) {
    return corsJson({ error: "Missing subject, html, or list" }, request, env, 400);
  }

  const subscribers = await getConfirmedSubscribers(env.DB, body.list);
  const sent = await sendToList(env, subscribers, body.subject, body.html);
  return corsJson({ sent }, request, env);
}

export async function handleAdminAdd(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return unauthorized(request, env);

  const body = await request.json<{ email?: string; list?: string }>();
  const email = body?.email?.trim().toLowerCase();
  const list = body?.list?.trim();
  if (!email || !email.includes("@")) {
    return corsJson({ error: "Invalid email" }, request, env, 400);
  }
  if (!list) {
    return corsJson({ error: "Missing list" }, request, env, 400);
  }

  const token = crypto.randomUUID();
  const result = await insertConfirmedSubscriber(env.DB, email, list, token);
  if ("error" in result) {
    return corsJson({ error: "Already subscribed" }, request, env, 409);
  }
  return corsJson({ ok: true }, request, env);
}

export async function handleAdminDelete(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return unauthorized(request, env);

  const body = await request.json<{ email?: string; list?: string }>();
  if (!body?.email) return corsJson({ error: "Missing email" }, request, env, 400);

  const email = body.email.trim().toLowerCase();
  const deleted = await deleteByEmail(env.DB, email, body.list);
  if (!deleted) {
    return corsJson({ error: "Not found" }, request, env, 404);
  }
  return corsJson({ ok: true, deleted }, request, env);
}

export async function handleAdminList(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return unauthorized(request, env);

  const url = new URL(request.url);
  const list = url.searchParams.get("list") ?? undefined;
  const results = await listSubscribers(env.DB, list);
  return corsJson(results, request, env);
}
