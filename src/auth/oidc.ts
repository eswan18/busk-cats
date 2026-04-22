import type { Env } from "../env";
import { randomB64Url, sha256B64Url } from "./crypto";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export async function makePkcePair(): Promise<PkcePair> {
  const verifier = randomB64Url(32);
  const challenge = await sha256B64Url(verifier);
  return { verifier, challenge };
}

export function makeState(): string {
  return randomB64Url(16);
}

export function authorizeUrl(env: Env, state: string, challenge: string): string {
  const redirectUri = `${env.WORKER_URL}/auth/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.OIDC_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "openid profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${env.OIDC_ISSUER}/oauth/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
}

export async function exchangeCode(
  env: Env,
  code: string,
  verifier: string,
): Promise<TokenResponse> {
  const redirectUri = `${env.WORKER_URL}/auth/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: env.OIDC_CLIENT_ID,
    client_secret: env.OIDC_CLIENT_SECRET,
    code_verifier: verifier,
  });

  const res = await fetch(`${env.OIDC_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json<TokenResponse>();
}

export interface UserInfo {
  sub: string;
  username?: string;
  email?: string;
}

export async function fetchUserInfo(env: Env, accessToken: string): Promise<UserInfo> {
  const res = await fetch(`${env.OIDC_ISSUER}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Userinfo fetch failed: ${res.status} ${text}`);
  }
  return res.json<UserInfo>();
}
