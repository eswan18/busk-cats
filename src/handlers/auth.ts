import type { Env } from "../env";
import { html, json } from "../cors";
import { authorizeUrl, exchangeCode, fetchUserInfo, makePkcePair, makeState } from "../auth/oidc";
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  oauthStateCookie,
  readOAuthState,
  readSession,
  sessionCookie,
  signOAuthState,
  signSession,
} from "../auth/session";

export async function handleAuthLogin(_request: Request, env: Env): Promise<Response> {
  const state = makeState();
  const { verifier, challenge } = await makePkcePair();
  const stateToken = await signOAuthState(state, verifier, env.SESSION_SECRET);
  const redirect = authorizeUrl(env, state, challenge);
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect,
      "Set-Cookie": oauthStateCookie(stateToken),
    },
  });
}

export async function handleAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return html("<p>Missing code or state.</p>", 400);

  const stored = await readOAuthState(request, env.SESSION_SECRET);
  if (!stored) return html("<p>OAuth state expired or missing. Please try again.</p>", 400);
  if (stored.state !== state) return html("<p>State mismatch.</p>", 400);

  let tokenRes;
  try {
    tokenRes = await exchangeCode(env, code, stored.verifier);
  } catch (e) {
    console.error(e);
    return html("<p>Token exchange failed.</p>", 502);
  }

  let user;
  try {
    user = await fetchUserInfo(env, tokenRes.access_token);
  } catch (e) {
    console.error(e);
    return html("<p>Failed to fetch user info.</p>", 502);
  }

  if (!user.username || user.username !== env.ALLOWED_USERNAME) {
    return html(`<h1>Access denied</h1><p>This app is not available to your account.</p>`, 403);
  }

  const sessionToken = await signSession(user.username, env.SESSION_SECRET);
  const headers = new Headers();
  headers.append("Location", "/");
  headers.append("Set-Cookie", sessionCookie(sessionToken));
  headers.append("Set-Cookie", clearOAuthStateCookie());
  return new Response(null, { status: 302, headers });
}

export async function handleAuthLogout(request: Request, env: Env): Promise<Response> {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return json({ error: "Not logged in" }, 401);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
