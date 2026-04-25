import { env, SELF, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signPayload } from "./auth/crypto";

function mockResend() {
  fetchMock
    .get("https://api.resend.com")
    .intercept({ path: "/emails", method: "POST" })
    .reply(200, { id: "mock-email-id" });
}

async function validSessionCookie(): Promise<string> {
  const token = await signPayload(
    { username: env.ALLOWED_USERNAME, exp: Math.floor(Date.now() / 1000) + 3600 },
    env.SESSION_SECRET,
  );
  return `session=${token}`;
}

async function resetDb() {
  await env.DB.prepare("DROP TABLE IF EXISTS subscribers").run();
  await env.DB.prepare(
    "CREATE TABLE subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, list TEXT NOT NULL, token TEXT UNIQUE NOT NULL, confirmed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), UNIQUE(email, list))",
  ).run();
  await env.DB.prepare("DROP TABLE IF EXISTS sent_notifications").run();
  await env.DB.prepare(
    "CREATE TABLE sent_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, list TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, post_link TEXT, recipient_count INTEGER NOT NULL, sent_by TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))",
  ).run();
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("GET /api/me", () => {
  it("returns 401 without a session", async () => {
    const res = await SELF.fetch("https://worker.test/api/me");
    expect(res.status).toBe(401);
  });

  it("returns the username with a valid session", async () => {
    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/api/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { username: string };
    expect(data.username).toBe(env.ALLOWED_USERNAME);
  });

  it("rejects a tampered session", async () => {
    const res = await SELF.fetch("https://worker.test/api/me", {
      headers: { Cookie: "session=bogus.mac" },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/lists", () => {
  it("returns 401 without a session", async () => {
    const res = await SELF.fetch("https://worker.test/api/lists");
    expect(res.status).toBe(401);
  });

  it("returns distinct lists with counts", async () => {
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog", "t1")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 0)")
      .bind("b@example.com", "blog", "t2")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("c@example.com", "notes", "t3")
      .run();

    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/api/lists", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<{ list: string; total: number; confirmed: number }>;
    expect(data).toEqual([
      { list: "blog", total: 2, confirmed: 1 },
      { list: "notes", total: 1, confirmed: 1 },
    ]);
  });
});

describe("GET /auth/login", () => {
  it("302s to the IdP with PKCE params and sets oauth_state", async () => {
    const res = await SELF.fetch("https://worker.test/auth/login", { redirect: "manual" });
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location.startsWith(`${env.OIDC_ISSUER}/oauth/authorize?`)).toBe(true);
    const url = new URL(location);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(env.OIDC_CLIENT_ID);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("scope")).toBe("openid profile");

    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("oauth_state=");
    expect(setCookie).toContain("HttpOnly");
  });
});

describe("POST /auth/logout", () => {
  it("returns 401 when not logged in", async () => {
    const res = await SELF.fetch("https://worker.test/auth/logout", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("clears the session cookie when logged in", async () => {
    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("session=;");
    expect(setCookie).toContain("Max-Age=0");
  });
});

describe("POST /api/subscribers", () => {
  it("adds pre-confirmed when skipConfirmation defaults to true", async () => {
    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/api/subscribers", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", list: "blog" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: true; confirmed: boolean };
    expect(data.confirmed).toBe(true);

    const { results } = await env.DB.prepare(
      "SELECT confirmed FROM subscribers WHERE email = ?",
    ).bind("a@example.com").all<{ confirmed: number }>();
    expect(results[0].confirmed).toBe(1);
  });

  it("sends a confirmation email when skipConfirmation is false", async () => {
    mockResend();
    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/api/subscribers", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "b@example.com", list: "blog", skipConfirmation: false }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: true; confirmed: boolean };
    expect(data.confirmed).toBe(false);

    const { results } = await env.DB.prepare(
      "SELECT confirmed FROM subscribers WHERE email = ?",
    ).bind("b@example.com").all<{ confirmed: number }>();
    expect(results[0].confirmed).toBe(0);
  });
});

describe("POST /api/send", () => {
  it("logs a sent_notifications row with sent_by=<username> and the link", async () => {
    mockResend();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog", "t1")
      .run();

    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/api/send", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Hello",
        html: "<p>Hi</p>",
        list: "blog",
        link: "https://example.com/post",
      }),
    });
    expect(res.status).toBe(200);

    const { results } = await env.DB.prepare("SELECT * FROM sent_notifications").all<{
      list: string;
      subject: string;
      post_link: string | null;
      recipient_count: number;
      sent_by: string;
    }>();
    expect(results.length).toBe(1);
    expect(results[0].list).toBe("blog");
    expect(results[0].subject).toBe("Hello");
    expect(results[0].post_link).toBe("https://example.com/post");
    expect(results[0].recipient_count).toBe(1);
    expect(results[0].sent_by).toBe(env.ALLOWED_USERNAME);
  });
});

describe("GET /api/sent", () => {
  it("returns 401 without a session", async () => {
    const res = await SELF.fetch("https://worker.test/api/sent");
    expect(res.status).toBe(401);
  });

  it("returns rows ordered newest-first, filtered by list", async () => {
    await env.DB.prepare(
      "INSERT INTO sent_notifications (list, subject, html, post_link, recipient_count, sent_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("blog", "First", "<p>1</p>", null, 5, "eswan18", "2026-01-01 10:00:00").run();
    await env.DB.prepare(
      "INSERT INTO sent_notifications (list, subject, html, post_link, recipient_count, sent_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("blog", "Second", "<p>2</p>", "https://x", 7, "eswan18", "2026-02-01 10:00:00").run();
    await env.DB.prepare(
      "INSERT INTO sent_notifications (list, subject, html, post_link, recipient_count, sent_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("notes", "Other", "<p>3</p>", null, 2, "eswan18", "2026-03-01 10:00:00").run();

    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/api/sent?list=blog", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<{ subject: string; recipient_count: number }>;
    expect(data.length).toBe(2);
    expect(data[0].subject).toBe("Second");
    expect(data[1].subject).toBe("First");
  });
});

describe("DELETE /api/subscribers", () => {
  it("deletes a subscriber when authed", async () => {
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog", "t1")
      .run();

    const cookie = await validSessionCookie();
    const res = await SELF.fetch("https://worker.test/api/subscribers", {
      method: "DELETE",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", list: "blog" }),
    });
    expect(res.status).toBe(200);
    const { results } = await env.DB.prepare("SELECT * FROM subscribers").all();
    expect(results.length).toBe(0);
  });

  it("returns 401 without a session", async () => {
    const res = await SELF.fetch("https://worker.test/api/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "x@example.com" }),
    });
    expect(res.status).toBe(401);
  });
});
