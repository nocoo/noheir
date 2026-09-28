import { createServer } from "node:net";
import { createNativeFixture } from "./test-fixture.ts";

const probe = createServer();
await new Promise<void>((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(7004, "127.0.0.1", resolve);
});
try {
  const fixture = await createNativeFixture({ persistentDemo: true });
  await fixture.close(true);
  console.log("Demo 存储已重置；下次启动会生成合成目录。原 .wrangler/state 未改动。");
} finally {
  probe.close();
}
