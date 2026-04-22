export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
  FROM_EMAIL: string;
  WORKER_URL: string;
  ALLOWED_ORIGINS: string;

  OIDC_ISSUER: string;
  ALLOWED_USERNAME: string;
  OIDC_CLIENT_ID: string;
  OIDC_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}
