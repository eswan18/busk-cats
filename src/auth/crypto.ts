function b64urlEncodeBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecodeBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64urlEncodeString(s: string): string {
  return b64urlEncodeBytes(new TextEncoder().encode(s));
}

export function b64urlDecodeString(s: string): string {
  return new TextDecoder().decode(b64urlDecodeBytes(s));
}

export function randomB64Url(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64urlEncodeBytes(a);
}

export async function sha256B64Url(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return b64urlEncodeBytes(hash);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function macBody(body: string, secret: string): Promise<string> {
  const mac = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(body),
  );
  return b64urlEncodeBytes(mac);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(payload: object, secret: string): Promise<string> {
  const body = b64urlEncodeString(JSON.stringify(payload));
  const mac = await macBody(body, secret);
  return `${body}.${mac}`;
}

export async function verifyPayload<T>(token: string, secret: string): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  if (!body || !mac) return null;

  let expected: string;
  try {
    expected = await macBody(body, secret);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, mac)) return null;

  let payload: T & { exp?: number };
  try {
    payload = JSON.parse(b64urlDecodeString(body));
  } catch {
    return null;
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}
