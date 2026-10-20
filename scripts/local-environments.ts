import { execFile } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promisify } from "node:util";
import { DEMO_ANCHOR, seedDemo } from "./demo-catalog.ts";
import { createNativeFixture, TEST_USERS } from "./test-fixture.ts";

export const LOCAL_ORIGIN = "https://noheir.dev.hexly.ai";
export const PROD_ORIGIN = "https://noheir.hexly.ai";
const LOGIN_REQUIRED =
  "Prod 尚未登录或登录已过期。请在终端运行 bun run prod:login，完成浏览器认证后重新选择 Prod。";
class ProductionAccessError extends Error {}

export function productionHeaders(credential: string, source?: HeadersInit) {
  const headers = new Headers(source);
  headers.delete("cookie");
  headers.delete("Cf-Access-Token");
  headers.set("Cookie", `CF_Authorization=${credential}`);
  headers.set("Cf-Access-Jwt-Assertion", credential);
  return headers;
}

export type Mode = "demo" | "e2e" | "prod";
export const isMode = (value: unknown): value is Mode =>
  typeof value === "string" && ["demo", "e2e", "prod"].includes(value);
type Fixture = Awaited<ReturnType<typeof createNativeFixture>>;
type Instance = {
  id: string;
  mode: Mode;
  fixture?: Fixture;
  credential?: string;
  expired: boolean;
  pending: Set<Promise<Response>>;
};

export async function createEnvironmentController(options: {
  origin: string;
  initial?: Mode;
  automated?: boolean;
  ci?: boolean;
  dataset?: "demo" | "empty";
  demoFixture?: Fixture;
  production?: boolean;
}) {
  const instances = new Map<string, Instance>();
  let demo: Fixture | undefined = options.demoFixture;
  let locked: Instance | undefined;
  const origin = options.origin;
  const visible = !options.ci;
  const describe = (instance: Instance) => ({
    protocol: "noheir-local-v1",
    id: instance.id,
    mode: instance.mode,
    locked: Boolean(options.automated),
    visible,
  });
  const create = async (mode: Mode): Promise<Instance> => {
    if (options.automated && mode !== "e2e") throw new Error("Automated E2E is locked");
    const instance: Instance = {
      id: crypto.randomUUID(),
      mode,
      expired: false,
      pending: new Set(),
    };
    if (mode === "prod") {
      if (options.production === false || options.ci)
        throw new Error("Production is unavailable in this test launcher");
      const { stdout } = await promisify(execFile)(
        "cloudflared",
        ["access", "token", "--app", PROD_ORIGIN],
        { timeout: 15_000 },
      ).catch(() => {
        throw new ProductionAccessError(LOGIN_REQUIRED);
      });
      const credential = stdout.trim();
      if (credential.split(".").length !== 3) throw new ProductionAccessError(LOGIN_REQUIRED);
      const response = await fetch(`${PROD_ORIGIN}/api/auth/me`, {
        headers: productionHeaders(credential),
        redirect: "manual",
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
        throw new ProductionAccessError(LOGIN_REQUIRED);
      instance.credential = credential;
      const live = await fetch(`${PROD_ORIGIN}/api/live`, {
        headers: productionHeaders(credential),
        redirect: "manual",
      });
      console.log("Production backend revision:", await live.text());
    } else {
      if (mode === "demo") {
        demo ??= await createNativeFixture({
          siteOrigin: origin,
          persistentDemo: true,
          presentationDate: DEMO_ANCHOR,
        });
        instance.fixture = demo;
        await seedDemo(demo);
      } else {
        instance.fixture = await createNativeFixture({
          siteOrigin: origin,
          ...(options.dataset === "demo" ? { presentationDate: DEMO_ANCHOR } : {}),
        });
        if (options.dataset === "demo") await seedDemo(instance.fixture);
      }
    }
    instances.set(instance.id, instance);
    return instance;
  };
  if (options.automated) locked = await create("e2e");
  const retire = async (instance: Instance) => {
    instance.expired = true;
    await Promise.allSettled(instance.pending);
    if (instance.mode === "e2e") await instance.fixture?.close();
    instances.delete(instance.id);
  };
  const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "cache-control": "no-store" } });
  let changing = false;
  const handle = async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (url.origin !== origin) return json({ error: "Untrusted local origin" }, 403);
    const machineRequest = url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/");
    if (
      !["GET", "HEAD"].includes(request.method) &&
      request.headers.get("origin") !== origin &&
      !(machineRequest && !request.headers.has("origin"))
    )
      return json({ error: "Cross-origin request rejected" }, 403);
    if (url.pathname === "/__local/environment") {
      if (request.method === "GET")
        return json({
          protocol: "noheir-local-v1",
          initial: options.initial ?? null,
          locked: Boolean(options.automated),
          visible,
        });
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (changing) return json({ error: "Environment transition in progress" }, 409);
      changing = true;
      try {
        const body = (await request.json()) as {
          mode?: unknown;
          instance?: string;
          action?: string;
        };
        if (options.automated) {
          if (body.action === "switch" || (body.mode !== undefined && body.mode !== "e2e"))
            return json({ error: "Automated E2E is locked" }, 409);
          return json(describe(locked as Instance));
        }
        const previous = body.instance ? instances.get(body.instance) : undefined;
        if (body.action === "switch") {
          if (!previous || previous.expired)
            return json({ error: "Instance expired; reload" }, 410);
          if (!isMode(body.mode)) return json({ error: "Unknown environment" }, 400);
          if (body.mode === previous.mode) return json(describe(previous));
          const next = await create(body.mode);
          await retire(previous);
          return json(describe(next));
        }
        if (body.action !== "start" && body.action !== "select")
          return json({ error: "Unknown action" }, 400);
        if (previous && !previous.expired) return json(describe(previous));
        const mode =
          body.action === "select" && isMode(body.mode)
            ? body.mode
            : (options.initial ?? (isMode(body.mode) ? body.mode : "demo"));
        return json(describe(await create(mode)));
      } catch (error) {
        console.error(
          "Local environment startup failed:",
          error instanceof Error ? error.message : "Unknown failure",
        );
        return json(
          {
            error:
              error instanceof ProductionAccessError
                ? error.message
                : "Environment unavailable. Check launcher output.",
          },
          503,
        );
      } finally {
        changing = false;
      }
    }
    if (
      !options.automated &&
      !url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/.well-known/")
    )
      return null;
    const instance = locked ?? instances.get(request.headers.get("x-noheir-instance") ?? "");
    if (!instance || instance.expired)
      return json({ error: "Instance expired; reload this tab" }, 410);
    const dispatch = async (): Promise<Response> => {
      const headers = new Headers(request.headers);
      headers.delete("x-noheir-instance");
      headers.delete("host");
      headers.delete("cookie");
      if (instance.mode === "prod") {
        if (headers.has("origin")) headers.set("origin", PROD_ORIGIN);
        headers.delete("referer");
        const target = new URL(url.pathname + url.search, PROD_ORIGIN);
        return fetch(target, {
          method: request.method,
          headers: productionHeaders(instance.credential ?? "", headers),
          body: request.body,
          duplex: "half",
          redirect: "manual",
        } as RequestInit);
      }
      const fixture = instance.fixture as Fixture;
      if (!options.automated)
        headers.set("Cf-Access-Jwt-Assertion", await fixture.token(`${TEST_USERS[0]}@test.local`));
      else if (request.headers.has("cookie"))
        headers.set("cookie", request.headers.get("cookie") as string);
      const response = await fixture.mf.dispatchFetch(request.url, {
        method: request.method,
        headers,
        body: request.body ? new Uint8Array(await request.arrayBuffer()) : null,
        redirect: "manual",
      });
      const reader = response.body?.getReader();
      const stream = reader
        ? new ReadableStream<Uint8Array>({
            async pull(controller) {
              const result = await reader.read();
              if (result.done) controller.close();
              else controller.enqueue(result.value);
            },
            cancel() {
              return reader.cancel();
            },
          })
        : null;
      return new Response(stream, {
        status: response.status,
        headers: Object.fromEntries(response.headers),
      });
    };
    const pending = dispatch();
    instance.pending.add(pending);
    try {
      const response = await pending;
      const headers = new Headers(response.headers);
      headers.delete("set-cookie");
      if (instance.mode === "prod") {
        headers.delete("content-encoding");
        headers.delete("content-length");
      }
      headers.set("cache-control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    } finally {
      instance.pending.delete(pending);
    }
  };
  return {
    handle,
    lockedFixture: locked?.fixture,
    async close() {
      for (const instance of instances.values()) await retire(instance);
      await demo?.close();
    },
  };
}

export function localMiddleware(
  controller: Awaited<ReturnType<typeof createEnvironmentController>>,
  origin: string,
) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    try {
      const allowedHosts = new Set([new URL(origin).host, "127.0.0.1:7004", "localhost:7004"]);
      if (!allowedHosts.has(req.headers.host ?? "")) {
        res.writeHead(403).end("Untrusted host");
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(new URL(req.url ?? "/", origin), {
        method: req.method ?? "GET",
        headers,
        ...(body ? { body } : {}),
      });
      const response = await controller.handle(request);
      if (!response) {
        next();
        return;
      }
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of response.body) res.write(chunk);
      res.end();
    } catch {
      res.writeHead(500).end("Local runtime error");
    }
  };
}
