import { describe, it, expect } from "vitest";
import { signPayload, verifyPayload } from "../src/auth/crypto";

const SECRET = "test-secret-abcdefg";

describe("signPayload / verifyPayload", () => {
  it("signs and verifies a roundtrip", async () => {
    const token = await signPayload({ username: "alice", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
    const out = await verifyPayload<{ username: string }>(token, SECRET);
    expect(out).not.toBeNull();
    expect(out?.username).toBe("alice");
  });

  it("rejects a tampered body", async () => {
    const token = await signPayload({ username: "alice", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
    const [, mac] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ username: "admin", exp: Math.floor(Date.now() / 1000) + 60 }))
      .toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const forged = `${forgedBody}.${mac}`;
    const out = await verifyPayload(forged, SECRET);
    expect(out).toBeNull();
  });

  it("rejects a wrong secret", async () => {
    const token = await signPayload({ username: "alice", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
    const out = await verifyPayload(token, "different-secret");
    expect(out).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signPayload({ username: "alice", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
    const out = await verifyPayload(token, SECRET);
    expect(out).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await verifyPayload("nope", SECRET)).toBeNull();
    expect(await verifyPayload("a.b.c", SECRET)).toBeNull();
    expect(await verifyPayload("", SECRET)).toBeNull();
  });
});
