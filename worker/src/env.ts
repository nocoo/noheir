export interface Env {
  DB: D1Database;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  SITE_URL: string;
  ENVIRONMENT: string;
  LOCAL_USER_EMAIL: string;
  BUILD_SHA: string;
}
