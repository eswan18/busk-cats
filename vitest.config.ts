import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            ADMIN_SECRET: "test-secret",
            RESEND_API_KEY: "re_test_fake",
          },
        },
      },
    },
  },
});
