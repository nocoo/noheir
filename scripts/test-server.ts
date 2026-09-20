import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createTestFixture, TEST_USERS } from "./test-fixture.ts";

const tokenFile = new URL("../.wrangler/browser-token.json", import.meta.url);
rmSync(tokenFile, { force: true });
const fixture = await createTestFixture(27004);
await fixture.assertMarker();
mkdirSync(new URL("../.wrangler/", import.meta.url), { recursive: true });
writeFileSync(tokenFile, JSON.stringify({ token: fixture.tokens[TEST_USERS[0] ?? ""] }), {
  mode: 0o600,
});
console.log(`Isolated browser fixture ready: ${fixture.origin}`);
await new Promise<void>((resolve) => {
  process.once("SIGINT", resolve);
  process.once("SIGTERM", resolve);
});
await fixture.close();

rmSync(tokenFile, { force: true });
