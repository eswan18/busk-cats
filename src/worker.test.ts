import { env, SELF, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

beforeEach(async () => {
  // Reset DB
  await env.DB.exec("DROP TABLE IF EXISTS subscribers;");
  await env.DB.exec("CREATE TABLE subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, list TEXT NOT NULL, token TEXT UNIQUE NOT NULL, confirmed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), UNIQUE(email, list));");
  // Mock Resend API to always succeed
  fetchMock
    .get("https://api.resend.com")
    .intercept({ path: "/emails", method: "POST" })
    .reply(200, { id: "mock-email-id" });
});

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.ADMIN_SECRET}`,
  };
}

describe("CORS", () => {
  it("allows configured origins", async () => {
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "OPTIONS",
      headers: { Origin: "https://ethanswan.com" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://ethanswan.com");
  });

  it("allows localhost origins", async () => {
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:1313" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:1313");
  });

  it("rejects unknown origins", async () => {
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.com" },
    });
    expect(res.status).toBe(204);
    const acao = res.headers.get("Access-Control-Allow-Origin");
    expect(acao === null || acao === "").toBe(true);
  });
});

describe("POST /subscribe", () => {
  it("subscribes a valid email", async () => {
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", list: "blog" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean };
    expect(data.ok).toBe(true);

    const { results } = await env.DB.prepare("SELECT * FROM subscribers").all();
    expect(results.length).toBe(1);
    expect(results[0].email).toBe("test@example.com");
    expect(results[0].list).toBe("blog");
    expect(results[0].confirmed).toBe(0);
  });

  it("rejects invalid email", async () => {
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "notanemail", list: "blog" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing list", async () => {
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate email+list", async () => {
    const body = JSON.stringify({ email: "test@example.com", list: "blog" });
    await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(res.status).toBe(409);
  });

  it("allows same email on different lists", async () => {
    await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", list: "blog1" }),
    });
    const res = await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", list: "blog2" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /confirm", () => {
  it("confirms a subscriber", async () => {
    await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", list: "blog" }),
    });
    const { results } = await env.DB.prepare("SELECT token FROM subscribers").all();
    const token = results[0].token as string;

    const res = await SELF.fetch(`https://worker.test/confirm?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");

    const { results: after } = await env.DB.prepare("SELECT confirmed FROM subscribers").all();
    expect(after[0].confirmed).toBe(1);
  });

  it("returns 404 for invalid token", async () => {
    const res = await SELF.fetch("https://worker.test/confirm?token=bogus");
    expect(res.status).toBe(404);
  });
});

describe("GET /unsubscribe", () => {
  it("deletes the subscriber", async () => {
    await SELF.fetch("https://worker.test/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", list: "blog" }),
    });
    const { results } = await env.DB.prepare("SELECT token FROM subscribers").all();
    const token = results[0].token as string;

    const res = await SELF.fetch(`https://worker.test/unsubscribe?token=${token}`);
    expect(res.status).toBe(200);

    const { results: after } = await env.DB.prepare("SELECT * FROM subscribers").all();
    expect(after.length).toBe(0);
  });
});

describe("POST /send", () => {
  it("requires auth", async () => {
    const res = await SELF.fetch("https://worker.test/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Hi", html: "<p>Hi</p>", list: "blog" }),
    });
    expect(res.status).toBe(401);
  });

  it("sends to confirmed subscribers only", async () => {
    // Add two subscribers, confirm only one
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("confirmed@example.com", "blog", "token1")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 0)")
      .bind("unconfirmed@example.com", "blog", "token2")
      .run();

    const res = await SELF.fetch("https://worker.test/send", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ subject: "Hi", html: "<p>Hi</p>", list: "blog" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { sent: number };
    expect(data.sent).toBe(1);
  });

  it("only sends to the specified list", async () => {
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog1", "token1")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("b@example.com", "blog2", "token2")
      .run();

    const res = await SELF.fetch("https://worker.test/send", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ subject: "Hi", html: "<p>Hi</p>", list: "blog1" }),
    });
    const data = await res.json() as { sent: number };
    expect(data.sent).toBe(1);
  });
});

describe("POST /admin/add", () => {
  it("requires auth", async () => {
    const res = await SELF.fetch("https://worker.test/admin/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", list: "blog" }),
    });
    expect(res.status).toBe(401);
  });

  it("adds a pre-confirmed subscriber", async () => {
    const res = await SELF.fetch("https://worker.test/admin/add", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ email: "test@example.com", list: "blog" }),
    });
    expect(res.status).toBe(200);

    const { results } = await env.DB.prepare("SELECT * FROM subscribers").all();
    expect(results.length).toBe(1);
    expect(results[0].confirmed).toBe(1);
  });
});

describe("GET /admin/list", () => {
  it("requires auth", async () => {
    const res = await SELF.fetch("https://worker.test/admin/list", {
      headers: {},
    });
    expect(res.status).toBe(401);
  });

  it("returns all subscribers", async () => {
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog1", "token1")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 0)")
      .bind("b@example.com", "blog2", "token2")
      .run();

    const res = await SELF.fetch("https://worker.test/admin/list", {
      headers: adminHeaders(),
    });
    const data = await res.json() as Array<unknown>;
    expect(data.length).toBe(2);
  });

  it("filters by list", async () => {
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog1", "token1")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("b@example.com", "blog2", "token2")
      .run();

    const res = await SELF.fetch("https://worker.test/admin/list?list=blog1", {
      headers: adminHeaders(),
    });
    const data = await res.json() as Array<{ email: string }>;
    expect(data.length).toBe(1);
    expect(data[0].email).toBe("a@example.com");
  });
});

describe("POST /admin/delete", () => {
  it("deletes from a specific list", async () => {
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog1", "token1")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog2", "token2")
      .run();

    const res = await SELF.fetch("https://worker.test/admin/delete", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ email: "a@example.com", list: "blog1" }),
    });
    expect(res.status).toBe(200);

    const { results } = await env.DB.prepare("SELECT * FROM subscribers").all();
    expect(results.length).toBe(1);
    expect(results[0].list).toBe("blog2");
  });

  it("deletes from all lists when no list specified", async () => {
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog1", "token1")
      .run();
    await env.DB.prepare("INSERT INTO subscribers (email, list, token, confirmed) VALUES (?, ?, ?, 1)")
      .bind("a@example.com", "blog2", "token2")
      .run();

    const res = await SELF.fetch("https://worker.test/admin/delete", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ email: "a@example.com" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { deleted: number };
    expect(data.deleted).toBe(2);
  });
});

describe("404", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await SELF.fetch("https://worker.test/nope");
    expect(res.status).toBe(404);
  });
});
