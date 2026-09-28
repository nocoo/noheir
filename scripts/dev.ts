import { execFileSync } from "node:child_process";
import { createServer, preview } from "vite";
import {
  createEnvironmentController,
  isMode,
  LOCAL_ORIGIN,
  localMiddleware,
} from "./local-environments.ts";

const args = process.argv.slice(2);
const modeIndex = args.indexOf("--mode");
const initial = modeIndex < 0 ? undefined : args[modeIndex + 1];
if (modeIndex >= 0 && !isMode(initial)) throw new Error("Expected --mode demo|e2e|prod");
if (
  args.some(
    (arg, i) => arg !== "--mode" && !(modeIndex >= 0 && i === modeIndex + 1) && arg !== "--built",
  )
)
  throw new Error("Unknown launch option");
process.env.NOHEIR_INTERACTIVE = "1";
const controller = await createEnvironmentController({
  origin: LOCAL_ORIGIN,
  ...(isMode(initial) ? { initial } : {}),
  ci: Boolean(process.env.CI),
});
console.log(
  "Local frontend revision:",
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
);
const plugin = {
  name: "noheir-local-environments",
  configureServer(server: {
    middlewares: { use: (handler: ReturnType<typeof localMiddleware>) => void };
  }) {
    server.middlewares.use(localMiddleware(controller, LOCAL_ORIGIN));
  },
  configurePreviewServer(server: {
    middlewares: { use: (handler: ReturnType<typeof localMiddleware>) => void };
  }) {
    server.middlewares.use(localMiddleware(controller, LOCAL_ORIGIN));
  },
};
const built = args.includes("--built");
const server = built
  ? await preview({
      plugins: [plugin],
      build: { outDir: "dist/client" },
      preview: {
        host: "127.0.0.1",
        port: 7004,
        strictPort: true,
        allowedHosts: ["noheir.dev.hexly.ai"],
      },
    })
  : await createServer({ plugins: [plugin] });
if ("listen" in server) await server.listen();
console.log(`本地环境已启动：${LOCAL_ORIGIN}（${initial ?? "浏览器偏好或 Demo"}）`);
const stop = async () => {
  await server.close();
  await controller.close();
  process.exit();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
