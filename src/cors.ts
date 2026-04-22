import type { Env } from "./env";

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim());
  const isLocalhost = origin.startsWith("http://localhost:") || origin === "http://localhost";
  const match = allowed.includes(origin) || isLocalhost;
  return {
    "Access-Control-Allow-Origin": match ? origin : "",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function corsJson(data: unknown, request: Request, env: Env, status = 200): Response {
  return json(data, status, corsHeaders(request, env));
}

export function html(body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Busk Cats</title></head><body style="font-family:sans-serif;max-width:480px;margin:40px auto;text-align:center;">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html;charset=utf-8" } },
  );
}
