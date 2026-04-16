import { describe, expect, it } from "bun:test";
import { GET } from "@/app/api/live/route";

describe("GET /api/live", () => {
  it("returns 200 with expected body", async () => {
    const res = await GET();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(body.component).toBe("noheir");
  });

  it("sets Cache-Control: no-store header", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
