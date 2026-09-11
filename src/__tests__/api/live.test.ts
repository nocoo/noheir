import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/live/route";
import { APP_VERSION } from "@/lib/version";

describe("GET /api/live", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("WORKER_URL", "https://worker.example.test");
    vi.stubEnv("WORKER_TOKEN", "test-only-token");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(Response.json({ results: [{ probe: 1 }] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it("returns 200 with surety-standard body", async () => {
    const res = await GET();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe(APP_VERSION);
    expect(body.component).toBe("noheir");
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.database).toEqual({ connected: true });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://worker.example.test/api/v1/query");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: { Authorization: "Bearer test-only-token", "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({ sql: "SELECT 1 AS probe", params: [] });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("sets Cache-Control: no-store header", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    [
      "HTTP failure",
      () => Response.json({ error: "private database diagnostic" }, { status: 503 }),
    ],
    ["invalid credentials", () => new Response("private auth diagnostic", { status: 401 })],
    ["HTML fallback", () => new Response("<html>Sign in</html>")],
    ["null body", () => Response.json(null)],
    ["missing results", () => Response.json({ status: "ok" })],
    ["empty results", () => Response.json({ results: [] })],
    ["missing probe", () => Response.json({ results: [{}] })],
    ["wrong probe", () => Response.json({ results: [{ probe: 0 }] })],
  ])("reports %s as an uncached 503", async (_name, response) => {
    fetchMock.mockResolvedValue(response());
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({
      status: "error",
      version: APP_VERSION,
      database: { connected: false },
    });
    expect(JSON.stringify(body)).not.toMatch(/private|test-only-token/);
  });

  it.each(["WORKER_URL", "WORKER_TOKEN"])(
    "reports missing %s without making a request",
    async (key) => {
      vi.stubEnv(key, "");
      const res = await GET();
      expect(res.status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reports transport failures without leaking their cause", async () => {
    fetchMock.mockRejectedValue(new Error("private network diagnostic with test-only-token"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.text()).not.toMatch(/private|test-only-token/);
  });

  it("aborts a dependency request after five seconds", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const pending = GET();
    expect(timeout).toHaveBeenCalledWith(5_000);
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "error", database: { connected: false } });
  });
});
