import type { Env } from "./env";
import { corsHeaders, json } from "./cors";
import {
  handleSubscribe,
  handleConfirm,
  handleUnsubscribe,
} from "./handlers/public";
import {
  handleAdminAdd,
  handleAdminDelete,
  handleAdminList,
  handleSend,
} from "./handlers/admin";
import {
  handleAuthLogin,
  handleAuthCallback,
  handleAuthLogout,
} from "./handlers/auth";
import {
  handleApiMe,
  handleApiLists,
  handleApiSubscribersGet,
  handleApiSubscribersPost,
  handleApiSubscribersDelete,
  handleApiSend,
} from "./handlers/api";

type RouteHandler = (request: Request, env: Env) => Promise<Response>;

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

const ROUTES: Route[] = [
  // Public
  { method: "POST", path: "/subscribe", handler: handleSubscribe },
  { method: "GET", path: "/confirm", handler: handleConfirm },
  { method: "GET", path: "/unsubscribe", handler: handleUnsubscribe },
  // Admin (Bearer auth, used by CLI)
  { method: "POST", path: "/send", handler: handleSend },
  { method: "POST", path: "/admin/add", handler: handleAdminAdd },
  { method: "POST", path: "/admin/delete", handler: handleAdminDelete },
  { method: "GET", path: "/admin/list", handler: handleAdminList },
  // Auth (OIDC flow)
  { method: "GET", path: "/auth/login", handler: handleAuthLogin },
  { method: "GET", path: "/auth/callback", handler: handleAuthCallback },
  { method: "POST", path: "/auth/logout", handler: handleAuthLogout },
  // API (session cookie auth, used by SPA)
  { method: "GET", path: "/api/me", handler: handleApiMe },
  { method: "GET", path: "/api/lists", handler: handleApiLists },
  { method: "GET", path: "/api/subscribers", handler: handleApiSubscribersGet },
  { method: "POST", path: "/api/subscribers", handler: handleApiSubscribersPost },
  { method: "DELETE", path: "/api/subscribers", handler: handleApiSubscribersDelete },
  { method: "POST", path: "/api/send", handler: handleApiSend },
];

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  try {
    for (const r of ROUTES) {
      if (r.method === request.method && r.path === pathname) {
        return await r.handler(request, env);
      }
    }
    // Fall through to static assets for anything else (SPA routes).
    if (env.ASSETS) {
      return await env.ASSETS.fetch(request);
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
}
