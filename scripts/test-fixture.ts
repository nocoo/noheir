import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { build } from "esbuild";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

export const TEST_USERS = ["e2e-user-alpha", "e2e-user-beta", "e2e-user-gamma"];
export const TEST_AUD = "noheir-local-test-audience";
export const TEST_ISSUER = "https://nocoo.cloudflareaccess.com";

export async function createTestFixture(port: number) {
  if (![17004, 27004].includes(port)) throw new Error("Test server requires a reserved local port");
  const state = mkdtempSync(join(tmpdir(), "noheir-test-"));
  const marker = crypto.randomUUID();
  const markerPath = join(state, "marker");
  writeFileSync(markerPath, marker, { mode: 0o600 });
  const pair = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "local-test", alg: "RS256", use: "sig" };
  const origin = `http://127.0.0.1:${port}`;
  const token = (email: string, audience = TEST_AUD, issuer = TEST_ISSUER, expiry = "30m") =>
    new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "local-test" })
      .setSubject(`access-sub-${email}`)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(pair.privateKey);
  const tokens: Record<string, string> = {};
  for (const id of TEST_USERS) tokens[id] = await token(`${id}@test.local`);
  tokens.unknown = await token("unknown@test.local");
  tokens.expired = await token(`${TEST_USERS[0]}@test.local`, TEST_AUD, TEST_ISSUER, "-1m");
  tokens.audience = await token(`${TEST_USERS[0]}@test.local`, "wrong-audience");
  tokens.issuer = await token(`${TEST_USERS[0]}@test.local`, TEST_AUD, "https://wrong.example");
  const bundle = await build({
    entryPoints: ["worker/src/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    mainFields: ["browser", "module", "main"],
    target: "es2022",
    conditions: ["workerd", "worker", "browser"],
    external: ["node:*"],
    define: { __BUILD_SHA__: JSON.stringify("test-build") },
  });
  const script = bundle.outputFiles[0]?.text;
  if (!script) throw new Error("Worker bundle missing");
  const assets = resolve("dist/client");
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      host: "127.0.0.1",
      port,
      modules: true,
      script,
      compatibilityDate: "2026-09-18",
      compatibilityFlags: ["nodejs_compat"],
      isolatedResourcePersistencePath: state,
      d1Databases: ["DB"],
      bindings: {
        ENVIRONMENT: "production",
        CF_ACCESS_TEAM_DOMAIN: "nocoo",
        CF_ACCESS_AUD: TEST_AUD,
        LOCAL_USER_EMAIL: "",
        SITE_URL: origin,
        BUILD_SHA: "test-build",
      },
      serviceBindings: {
        ASSETS: async (request) => {
          const pathname = decodeURIComponent(new URL(request.url).pathname);
          const file = resolve(assets, `.${pathname}`);
          if (!file.startsWith(`${assets}/`) && file !== assets)
            return new Response(null, { status: 400 });
          const types: Record<string, string> = {
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon",
            ".woff2": "font/woff2",
            ".html": "text/html",
          };
          try {
            return new Response(readFileSync(file), {
              headers: { "content-type": types[extname(file)] ?? "application/octet-stream" },
            });
          } catch {
            return new Response(readFileSync(join(assets, "index.html")), {
              headers: { "content-type": "text/html" },
            });
          }
        },
      },
      outboundService: async (request) =>
        new URL(request.url).href === `${TEST_ISSUER}/cdn-cgi/access/certs`
          ? Response.json({ keys: [jwk] })
          : new Response("Unexpected outbound request", { status: 503 }),
    }),
  );
  const db = await mf.getD1Database("DB");
  const assertMarker = async () => {
    if (readFileSync(markerPath, "utf8") !== marker)
      throw new Error("Test directory marker mismatch");
    const row = await db.prepare("SELECT id FROM _test_marker").first<{ id: string }>();
    if (row?.id !== marker) throw new Error("Test database marker mismatch");
  };
  try {
    await db.exec("CREATE TABLE _test_marker (id TEXT NOT NULL)");
    await db.prepare("INSERT INTO _test_marker VALUES (?)").bind(marker).run();
    for (const file of readdirSync("worker/db/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await assertMarker();
      const sql = readFileSync(join("worker/db/migrations", file), "utf8");
      for (const statement of sql
        .replace(/--[^\n]*/g, "")
        .split(";")
        .filter((s) => s.trim())) {
        await db.exec(statement.replace(/\s+/g, " ").trim());
      }
    }
    await assertMarker();
    for (const id of TEST_USERS) {
      await db
        .prepare("INSERT INTO users (id,email,name,provider_account_id) VALUES (?,?,?,?)")
        .bind(id, `${id}@test.local`, id, id)
        .run();
    }
    for (const table of ["transactions", "transfers"]) {
      await assertMarker();
      await db
        .prepare(`CREATE TRIGGER injected_${table}_failure BEFORE INSERT ON ${table}
        WHEN NEW.note = 'test-injected-write-failure'
        BEGIN SELECT RAISE(ABORT, 'injected test write failure'); END;`)
        .run();
    }
    await mf.ready;
  } catch (error) {
    await mf.dispose();
    throw error;
  }
  return {
    origin,
    tokens,
    db,
    marker,
    markerPath,
    assertMarker,
    async close() {
      try {
        await assertMarker();
      } finally {
        await mf.dispose();
      }
      if (readFileSync(markerPath, "utf8") !== marker)
        throw new Error("Refusing test state cleanup");
      rmSync(state, { recursive: true });
    },
  };
}
