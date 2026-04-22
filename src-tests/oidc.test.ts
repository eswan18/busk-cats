import { describe, it, expect } from "vitest";
import { randomB64Url, sha256B64Url } from "../src/auth/crypto";
import { makePkcePair } from "../src/auth/oidc";

describe("PKCE", () => {
  it("verifier is 43-128 chars and url-safe", async () => {
    const { verifier } = await makePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("S256 matches the RFC 7636 test vector", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await sha256B64Url(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("random bytes produce distinct values", () => {
    const a = randomB64Url(16);
    const b = randomB64Url(16);
    expect(a).not.toBe(b);
  });
});
