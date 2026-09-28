import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

export const TEST_USERS = ["e2e-user-alpha", "e2e-user-beta", "e2e-user-gamma"];
export const TEST_AUD = "noheir-local-test-audience";
export const TEST_ISSUER = "https://nocoo.cloudflareaccess.com";

export async function createTestFixture(port: number) {
  if (![17004, 27004].includes(port)) throw new Error("Test server requires a reserved local port");
  return createNativeFixture({ port });
}

export const DEMO_STATE = resolve(".wrangler/environments/demo");

export async function createNativeFixture(
  options: {
    port?: number;
    siteOrigin?: string;
    persistentDemo?: boolean;
    presentationDate?: string;
    resume?: { state: string; marker: string };
  } = {},
) {
  const port = options.port ?? 0;
  if (
    options.resume &&
    (options.persistentDemo || !options.resume.state.startsWith(join(tmpdir(), "noheir-test-")))
  )
    throw new Error("Refusing foreign fixture resume");
  const state =
    options.resume?.state ??
    (options.persistentDemo ? DEMO_STATE : mkdtempSync(join(tmpdir(), "noheir-test-")));
  const fresh = !options.resume && (!options.persistentDemo || !existsSync(state));
  if (fresh) mkdirSync(state, { recursive: true, mode: 0o700 });
  if (realpathSync(state) !== state && realpathSync(state) !== resolve("/private", state.slice(1)))
    throw new Error("Refusing symlinked fixture state");
  const markerPath = join(state, "marker");
  const marker = fresh ? crypto.randomUUID() : readFileSync(markerPath, "utf8");
  if (options.resume && marker !== options.resume.marker)
    throw new Error("Fixture resume marker mismatch");
  if (fresh) writeFileSync(markerPath, marker, { mode: 0o600 });
  const pair = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "local-test", alg: "RS256", use: "sig" };
  const origin = options.siteOrigin ?? `http://127.0.0.1:${port}`;
  const runtime = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
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
    define: {
      __BUILD_SHA__: JSON.stringify("test-build"),
      __PRESENTATION_DATE__: JSON.stringify(options.presentationDate ?? null),
    },
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
      compatibilityDate: runtime.compatibility_date,
      compatibilityFlags: runtime.compatibility_flags,
      resourcePersistencePath: state,
      d1Databases: ["DB"],
      bindings: {
        ENVIRONMENT: "production",
        CF_ACCESS_TEAM_DOMAIN: "nocoo",
        CF_ACCESS_AUD: TEST_AUD,
        SITE_URL: origin,
        BUILD_SHA: "test-build",
      },
      assets: {
        directory: assets,
        binding: "ASSETS",
        routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
        run_worker_first: runtime.assets.run_worker_first,
        assetConfig: { not_found_handling: runtime.assets.not_found_handling },
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
    if (fresh) {
      await db.exec("CREATE TABLE _test_marker (id TEXT NOT NULL)");
      await db.prepare("INSERT INTO _test_marker VALUES (?)").bind(marker).run();
    }
    await assertMarker();
    await db.exec("CREATE TABLE IF NOT EXISTS _fixture_migrations (name TEXT PRIMARY KEY)");
    for (const file of readdirSync("worker/db/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await assertMarker();
      if (
        await db.prepare("SELECT name FROM _fixture_migrations WHERE name = ?").bind(file).first()
      )
        continue;
      const sql = readFileSync(join("worker/db/migrations", file), "utf8");
      for (const statement of sql
        .replace(/--[^\n]*/g, "")
        .split(";")
        .filter((s) => s.trim())) {
        await db.exec(statement.replace(/\s+/g, " ").trim());
      }
      await db.prepare("INSERT INTO _fixture_migrations VALUES (?)").bind(file).run();
    }
    await assertMarker();
    for (const id of TEST_USERS) {
      await db
        .prepare("INSERT OR IGNORE INTO users (id,email,name,provider_account_id) VALUES (?,?,?,?)")
        .bind(id, `${id}@test.local`, id, id)
        .run();
    }
    for (const table of ["transactions", "transfers"]) {
      await assertMarker();
      await db
        .prepare(`CREATE TRIGGER IF NOT EXISTS injected_${table}_failure BEFORE INSERT ON ${table}
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
    state,
    mf,
    token,
    tokens,
    db,
    marker,
    markerPath,
    assertMarker,
    async close(remove = !options.persistentDemo) {
      try {
        await assertMarker();
      } finally {
        await mf.dispose();
      }
      if (readFileSync(markerPath, "utf8") !== marker)
        throw new Error("Refusing test state cleanup");
      if (remove) rmSync(state, { recursive: true });
    },
  };
}
