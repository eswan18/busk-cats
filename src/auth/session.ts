import { signPayload, verifyPayload } from "./crypto";

export interface SessionPayload {
  username: string;
  exp: number;
}

export interface OAuthStatePayload {
  state: string;
  verifier: string;
  exp: number;
}

const SESSION_COOKIE = "session";
const OAUTH_STATE_COOKIE = "oauth_state";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

export async function signSession(username: string, secret: string): Promise<string> {
  const payload: SessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return signPayload(payload, secret);
}

export async function readSession(
  request: Request,
  secret: string,
): Promise<SessionPayload | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return verifyPayload<SessionPayload>(token, secret);
}

export async function signOAuthState(
  state: string,
  verifier: string,
  secret: string,
): Promise<string> {
  const payload: OAuthStatePayload = {
    state,
    verifier,
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
  };
  return signPayload(payload, secret);
}

export async function readOAuthState(
  request: Request,
  secret: string,
): Promise<OAuthStatePayload | null> {
  const token = readCookie(request, OAUTH_STATE_COOKIE);
  if (!token) return null;
  return verifyPayload<OAuthStatePayload>(token, secret);
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function oauthStateCookie(token: string): string {
  return `${OAUTH_STATE_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${OAUTH_STATE_TTL_SECONDS}`;
}

export function clearOAuthStateCookie(): string {
  return `${OAUTH_STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
