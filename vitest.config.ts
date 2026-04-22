import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    name: "workers",
    include: ["src/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            ADMIN_SECRET: "test-secret",
            RESEND_API_KEY: "re_test_fake",
            SESSION_SECRET: "test-session-secret",
            OIDC_ISSUER: "https://identity.test",
            ALLOWED_USERNAME: "eswan18",
            OIDC_CLIENT_ID: "test-client",
            OIDC_CLIENT_SECRET: "test-client-secret",
          },
        },
      },
    },
  },
});
