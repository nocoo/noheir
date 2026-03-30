import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [tailwindcss()],
  server: {
    host: "::",
    port: 7004,
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
    include: ["react", "react-dom", "react-router-dom"],
  },
}));
