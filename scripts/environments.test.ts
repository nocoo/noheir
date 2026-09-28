import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { seedDemo } from "./demo-catalog.ts";
import {
  createEnvironmentController,
  LOCAL_ORIGIN,
  productionHeaders,
} from "./local-environments.ts";
import { createNativeFixture, TEST_USERS } from "./test-fixture.ts";

const request = (path: string, body?: unknown, id?: string, origin = LOCAL_ORIGIN) =>
  new Request(`${LOCAL_ORIGIN}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(id ? { "x-noheir-instance": id } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const control = (body: unknown) => request("/__local/environment", body);

test("manual E2E is switchable, fresh on reentry; stale requests never retarget", async () => {
  const demo = await createNativeFixture({ siteOrigin: LOCAL_ORIGIN });
  const controller = await createEnvironmentController({
    origin: LOCAL_ORIGIN,
    initial: "e2e",
    demoFixture: demo,
    production: false,
  });
  try {
    const started = await (await controller.handle(
      control({ action: "start", mode: "demo" }),
    ))!.json();
    assert.equal(started.mode, "e2e");
    assert.equal(started.locked, false);
    const created = await controller.handle(
      request("/api/products", { name: "Ephemeral product" }, started.id),
    );
    assert.equal(created?.status, 201);
    const other = await (await controller.handle(
      control({ action: "start", mode: "e2e" }),
    ))!.json();
    const otherRows = await (await controller.handle(
      request("/api/products", undefined, other.id),
    ))!.json();
    assert.equal(otherRows.products.length, 0);
    const pendingWrite = controller.handle(
      request("/api/products", { name: "In-flight old write" }, started.id),
    );
    const switched = await (await controller.handle(
      control({ action: "switch", instance: started.id, mode: "demo" }),
    ))!.json();
    assert.equal(switched.mode, "demo");
    assert.equal((await pendingWrite)?.status, 201);
    const demoProducts = await (await controller.handle(
      request("/api/products", undefined, switched.id),
    ))!.json();
    assert.equal(
      demoProducts.products.some(
        (product: { name: string }) => product.name === "In-flight old write",
      ),
      false,
    );
    assert.equal(
      (await controller.handle(control({ action: "switch", instance: switched.id, mode: "prod" })))
        ?.status,
      503,
    );
    assert.equal(
      (await controller.handle(request("/api/products", undefined, switched.id)))?.status,
      200,
    );

    assert.equal(
      (await controller.handle(request("/api/products", { name: "Stale write" }, started.id)))
        ?.status,
      410,
    );
    const reentry = await (await controller.handle(
      control({ action: "switch", instance: switched.id, mode: "e2e" }),
    ))!.json();
    assert.notEqual(reentry.id, started.id);
    assert.equal(
      (await (await controller.handle(request("/api/products", undefined, reentry.id)))!.json())
        .products.length,
      0,
    );
    assert.equal(
      (
        await controller.handle(
          control({ action: "switch", instance: reentry.id, mode: "https://example.com" }),
        )
      )?.status,
      400,
    );
    assert.equal(
      (
        await controller.handle(
          request("/api/products", { name: "Cross origin" }, reentry.id, "https://example.com"),
        )
      )?.status,
      403,
    );
  } finally {
    await controller.close();
  }
  assert.equal(existsSync(demo.state), false);
});

test("remembered manual E2E starts fresh; automated E2E enforces lock and hides in CI", async () => {
  const manual = await createEnvironmentController({ origin: LOCAL_ORIGIN });
  try {
    const selected = await (await manual.handle(
      control({ action: "start", mode: "e2e", instance: "expired" }),
    ))!.json();
    assert.equal(selected.mode, "e2e");
    assert.equal(selected.locked, false);
  } finally {
    await manual.close();
  }
  for (const ci of [false, true]) {
    const controller = await createEnvironmentController({
      origin: LOCAL_ORIGIN,
      automated: true,
      ci,
    });
    try {
      const started = await (await controller.handle(control({ action: "start" })))!.json();
      assert.equal(started.mode, "e2e");
      assert.equal(started.locked, true);
      assert.equal(started.visible, !ci);
      assert.equal(
        (await controller.handle(control({ action: "switch", instance: started.id, mode: "prod" })))
          ?.status,
        409,
      );
      assert.equal(
        (await controller.handle(control({ action: "start", mode: "demo" })))?.status,
        409,
      );
      assert.equal((await controller.handle(request("/api/auth/me")))?.status, 401);
      const f = controller.lockedFixture!;
      for (const key of ["expired", "issuer", "audience"]) {
        const req = request("/api/auth/me");
        req.headers.set("Cf-Access-Jwt-Assertion", f.tokens[key]!);
        assert.equal((await controller.handle(req))?.status, 401);
      }
      const req = request("/api/auth/me");
      req.headers.set("Cf-Access-Jwt-Assertion", f.tokens[TEST_USERS[0]!]!);
      assert.equal((await controller.handle(req))?.status, 200);
    } finally {
      await controller.close();
    }
  }
});

test("Demo catalog persists edits across native restart; cleanup refuses foreign markers", async () => {
  let fixture = await createNativeFixture();
  await seedDemo(fixture);
  await fixture.db
    .prepare("UPDATE financial_products SET name = ? WHERE code = ?")
    .bind("Retained edit", "DEMO-1")
    .run();
  const resume = { state: fixture.state, marker: fixture.marker };
  await fixture.close(false);
  fixture = await createNativeFixture({ resume });
  try {
    await seedDemo(fixture);
    assert.equal(
      (
        await fixture.db
          .prepare("SELECT name FROM financial_products WHERE code = ?")
          .bind("DEMO-1")
          .first<{ name: string }>()
      )?.name,
      "Retained edit",
    );
    const marker = readFileSync(fixture.markerPath, "utf8");
    writeFileSync(fixture.markerPath, "foreign");
    await assert.rejects(fixture.assertMarker(), /marker mismatch/);
    writeFileSync(fixture.markerPath, marker);
    assert.equal(
      (await fixture.db.prepare("SELECT COUNT(*) AS n FROM transactions").first<{ n: number }>())
        ?.n,
      264,
    );
  } finally {
    await fixture.close();
  }
  assert.equal(existsSync(resume.state), false);
  await assert.rejects(
    createNativeFixture({ resume: { state: "/tmp/foreign", marker: "foreign" } }),
    /foreign/,
  );
});

test("production edge credentials replace browser identity and cookies", () => {
  const headers = productionHeaders("server-token", {
    cookie: "CF_Authorization=browser-token; private=local",
    "Cf-Access-Jwt-Assertion": "untrusted",
    "Cf-Access-Token": "untrusted",
    "Content-Type": "application/json",
  });
  assert.equal(headers.get("cookie"), "CF_Authorization=server-token");
  assert.equal(headers.get("Cf-Access-Jwt-Assertion"), "server-token");
  assert.equal(headers.has("Cf-Access-Token"), false);
  assert.equal(headers.get("Content-Type"), "application/json");
});
