import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createEnvironmentController, localMiddleware } from "./local-environments.ts";
import { TEST_USERS } from "./test-fixture.ts";

const origin = "http://127.0.0.1:27004";
const starting = (
  _req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) => {
  res.writeHead(503).end("Starting isolated runtime");
};
const server = createServer(starting);
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(27004, "127.0.0.1", resolve);
});
const controller = await createEnvironmentController({
  origin,
  automated: true,
  ci: Boolean(process.env.CI),
  dataset: process.env.NOHEIR_DATASET === "demo" ? "demo" : "empty",
});
const fixture = controller.lockedFixture;
if (!fixture) throw new Error("Missing locked E2E fixture");
const middleware = localMiddleware(controller, origin);
server.removeListener("request", starting);
server.on("request", (req, res) => {
  void middleware(req, res, () => {
    res.writeHead(404).end();
  });
});
const tokenFile = new URL("../.wrangler/browser-token.json", import.meta.url);
await fixture.assertMarker();
mkdirSync(new URL("../.wrangler/", import.meta.url), { recursive: true });
writeFileSync(tokenFile, JSON.stringify({ token: fixture.tokens[TEST_USERS[0] ?? ""] }), {
  mode: 0o600,
});
console.log(`隔离浏览器环境已就绪：${origin}`);
await new Promise<void>((resolve) => {
  process.once("SIGINT", resolve);
  process.once("SIGTERM", resolve);
});
await new Promise<void>((resolve) => server.close(() => resolve()));
await controller.close();
rmSync(tokenFile, { force: true });
