import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/dm-sans/index.css";
import "@/app/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Providers } from "@/components/providers";
import { initializeEnvironment } from "./components/environment-runtime";
import { EnvironmentStartupError } from "./components/environment-startup";
import { routes } from "./routes";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");
const root = createRoot(container);
try {
  await initializeEnvironment();
  const router = createBrowserRouter(routes);
  root.render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
} catch (error) {
  root.render(
    <EnvironmentStartupError
      message={error instanceof Error ? error.message : "Unable to start the application"}
    />,
  );
}
