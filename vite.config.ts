import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 7012,
    allowedHosts: ["noheir.dev.hexly.ai"],
  },
  esbuild: {
    jsx: "automatic" as const,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Bun 优化配置
    include: ["react", "react-dom", "react-router-dom"],
  },
}));
