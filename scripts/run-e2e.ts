import { spawn } from "node:child_process";
import { createTestFixture } from "./test-fixture.ts";

const fixture = await createTestFixture(17004);
try {
  await fixture.assertMarker();
  const child = spawn("bun", ["x", "vitest", "run", "--config", "vitest.http.config.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NOHEIR_TEST_ORIGIN: fixture.origin,
      NOHEIR_TEST_TOKENS: JSON.stringify(fixture.tokens),
      NOHEIR_TEST_MARKER: fixture.marker,
      NOHEIR_TEST_MARKER_PATH: fixture.markerPath,
    },
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await fixture.close();
}
