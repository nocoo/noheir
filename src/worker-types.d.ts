import type * as Cloudflare from "@cloudflare/workers-types";

declare global {
  type D1Database = Cloudflare.D1Database;
  type D1PreparedStatement = Cloudflare.D1PreparedStatement;
}
