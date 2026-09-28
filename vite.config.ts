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
    ...(process.env.NOHEIR_INTERACTIVE === "1"
      ? []
      : [
          cloudflare({
            remoteBindings: false,
            inspectorPort: false,
          }),
        ]),
  ],
  define: {
    __PRESENTATION_DATE__: "null",
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
