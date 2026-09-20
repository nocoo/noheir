import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({
      remoteBindings: false,
      inspectorPort: false,
      persistState: { path: process.env.NOHEIR_TEST_STATE ?? ".wrangler/state" },
    }),
  ],
  define: {
    __BUILD_SHA__: JSON.stringify(
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    ),
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "127.0.0.1",
    port: 7004,
    strictPort: true,
    allowedHosts: ["noheir.dev.hexly.ai"],
  },
});
