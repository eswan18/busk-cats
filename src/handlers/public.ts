import type { Env } from "../env";
import { corsJson, html } from "../cors";
import {
  insertPendingSubscriber,
  confirmSubscriber,
  deleteByToken,
} from "../db";
import { sendEmail } from "../email";

export async function handleSubscribe(request: Request, env: Env): Promise<Response> {
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
  const result = await insertPendingSubscriber(env.DB, email, list, token);
  if ("error" in result) {
    return corsJson({ error: "Already subscribed" }, request, env, 409);
  }

  const confirmUrl = `${env.WORKER_URL}/confirm?token=${token}`;
  await sendEmail(
    env,
    email,
    "Confirm your subscription",
    `<p>Thanks for subscribing! Please <a href="${confirmUrl}">click here to confirm</a>.</p>`,
  );

  return corsJson({ ok: true }, request, env);
}

export async function handleConfirm(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return html("<p>Invalid link.</p>", 400);

  const ok = await confirmSubscriber(env.DB, token);
  if (!ok) return html("<p>Token not found.</p>", 404);
  return html("<h1>You're subscribed!</h1><p>You'll receive emails when new posts are published.</p>");
}

export async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return html("<p>Invalid link.</p>", 400);

  const ok = await deleteByToken(env.DB, token);
  if (!ok) return html("<p>Token not found.</p>", 404);
  return html("<h1>You've been unsubscribed.</h1><p>You won't receive any more emails.</p>");
}
